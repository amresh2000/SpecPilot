import re
import tempfile
import os
from typing import Dict, List, Any, Optional
from docx import Document


class BRDParser:
    """Parse BRD documents (.docx and .txt) into structured format"""

    def __init__(self, s3_storage=None):
        """
        Initialize BRD Parser

        Args:
            s3_storage: Optional S3Storage instance for S3-based parsing
        """
        self.s3_storage = s3_storage

    def _get_parent_section_id(self, section_id: str) -> Optional[str]:
        """
        Get parent section ID from a hierarchical section ID.

        Examples:
            "3.1.2" -> "3.1"
            "3.1" -> "3"
            "3" -> None

        Args:
            section_id: Section ID like "3.1.2"

        Returns:
            Parent section ID or None if root level
        """
        parts = section_id.split('.')
        if len(parts) <= 1:
            return None
        return '.'.join(parts[:-1])

    def _get_heading_level(self, section_id: str) -> int:
        """
        Get heading level from section ID.

        Examples:
            "3" -> 1
            "3.1" -> 2
            "3.1.2" -> 3

        Args:
            section_id: Section ID like "3.1.2"

        Returns:
            Heading level (depth in hierarchy)
        """
        return len(section_id.split('.'))

    def parse_docx(self, file_path: str) -> Dict[str, Any]:
        """Parse .docx file and extract sections, tables, and text"""
        doc = Document(file_path)
        sections = []
        tables = []
        raw_text = []
        chunks = []

        current_section = None
        chunk_id = 0
        section_paragraphs = []

        # Extract paragraphs and sections
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            raw_text.append(text)

            # Check if this is a heading
            if para.style.name.startswith('Heading'):
                # If we have a previous section with content, create its chunk
                if current_section and section_paragraphs:
                    chunk_id += 1
                    section_content = "\n\n".join(section_paragraphs)
                    chunk = {
                        "id": f"chunk_{chunk_id}",
                        "type": "section",
                        "section_id": current_section["id"],
                        "section_title": current_section["title"],
                        "heading_level": self._get_heading_level(current_section["id"]),
                        "parent_section_id": self._get_parent_section_id(current_section["id"]),
                        "text": section_content
                    }
                    chunks.append(chunk)
                    current_section["chunk_ids"].append(f"chunk_{chunk_id}")
                    section_paragraphs = []

                # Extract section number if present
                section_match = re.match(r'^(\d+(?:\.\d+)*)\s+(.*)', text)
                if section_match:
                    section_id = section_match.group(1)
                    title = section_match.group(2)
                else:
                    section_id = f"section_{len(sections) + 1}"
                    title = text

                current_section = {
                    "id": section_id,
                    "title": title,
                    "text": "",
                    "chunk_ids": []
                }
                sections.append(current_section)
            else:
                # Regular paragraph - accumulate for section chunk
                if current_section:
                    current_section["text"] += text + "\n"
                    section_paragraphs.append(text)

        # Create chunk for the final section if it has content
        if current_section and section_paragraphs:
            chunk_id += 1
            section_content = "\n\n".join(section_paragraphs)
            chunk = {
                "id": f"chunk_{chunk_id}",
                "type": "section",
                "section_id": current_section["id"],
                "section_title": current_section["title"],
                "heading_level": self._get_heading_level(current_section["id"]),
                "parent_section_id": self._get_parent_section_id(current_section["id"]),
                "text": section_content
            }
            chunks.append(chunk)
            current_section["chunk_ids"].append(f"chunk_{chunk_id}")

        # Extract tables
        for table_idx, table in enumerate(doc.tables):
            if len(table.rows) < 2:
                continue  # Skip tables without headers

            # Extract headers from first row
            headers = [cell.text.strip() for cell in table.rows[0].cells]

            # Skip if headers are empty
            if not any(headers):
                continue

            # Extract rows
            rows = []
            for row in table.rows[1:]:
                row_data = {}
                for idx, cell in enumerate(row.cells):
                    if idx < len(headers) and headers[idx]:
                        row_data[headers[idx]] = cell.text.strip()
                if row_data:
                    rows.append(row_data)

            table_data = {
                "table_id": f"table_{table_idx + 1}",
                "section_id": current_section["id"] if current_section else None,
                "headers": headers,
                "rows": rows
            }
            tables.append(table_data)

            # Create chunk for table with full data (not truncated)
            chunk_id += 1
            chunk_text = f"Table: {', '.join(headers)}\n"
            for row in rows:  # Include ALL rows, not just first 3
                chunk_text += str(row) + "\n"
            chunks.append({
                "id": f"chunk_{chunk_id}",
                "type": "table",
                "section_id": current_section["id"] if current_section else None,
                "section_title": current_section["title"] if current_section else None,
                "heading_level": self._get_heading_level(current_section["id"]) if current_section else None,
                "parent_section_id": self._get_parent_section_id(current_section["id"]) if current_section else None,
                "text": chunk_text,
                "table_ref": table_data["table_id"]
            })

        return {
            "sections": sections,
            "tables": tables,
            "raw_text": "\n".join(raw_text),
            "chunks": chunks
        }

    def parse_txt(self, file_path: str) -> Dict[str, Any]:
        """Parse .txt file and extract sections using simple heuristics"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        sections = []
        chunks = []
        current_section = None
        chunk_id = 0
        section_lines = []

        lines = content.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if line is a section header (starts with numbers like 1., 1.1, 1.1.1)
            section_match = re.match(r'^(\d+(?:\.\d+)*\.?)\s+(.*)', line)

            if section_match:
                # If we have a previous section with content, create its chunk
                if current_section and section_lines:
                    chunk_id += 1
                    section_content = "\n\n".join(section_lines)
                    chunk = {
                        "id": f"chunk_{chunk_id}",
                        "type": "section",
                        "section_id": current_section["id"],
                        "section_title": current_section["title"],
                        "heading_level": self._get_heading_level(current_section["id"]),
                        "parent_section_id": self._get_parent_section_id(current_section["id"]),
                        "text": section_content
                    }
                    chunks.append(chunk)
                    current_section["chunk_ids"].append(f"chunk_{chunk_id}")
                    section_lines = []

                section_id = section_match.group(1).rstrip('.')
                title = section_match.group(2)

                current_section = {
                    "id": section_id,
                    "title": title,
                    "text": "",
                    "chunk_ids": []
                }
                sections.append(current_section)
            else:
                # Regular content - accumulate for section chunk
                if current_section:
                    current_section["text"] += line + "\n"
                    section_lines.append(line)
                else:
                    # Create a default section if none exists
                    current_section = {
                        "id": "intro",
                        "title": "Introduction",
                        "text": line + "\n",
                        "chunk_ids": []
                    }
                    sections.append(current_section)
                    section_lines.append(line)

        # Create chunk for the final section if it has content
        if current_section and section_lines:
            chunk_id += 1
            section_content = "\n\n".join(section_lines)
            chunk = {
                "id": f"chunk_{chunk_id}",
                "type": "section",
                "section_id": current_section["id"],
                "section_title": current_section["title"],
                "heading_level": self._get_heading_level(current_section["id"]),
                "parent_section_id": self._get_parent_section_id(current_section["id"]),
                "text": section_content
            }
            chunks.append(chunk)
            current_section["chunk_ids"].append(f"chunk_{chunk_id}")

        return {
            "sections": sections,
            "tables": [],  # txt files don't have tables
            "raw_text": content,
            "chunks": chunks
        }

    def parse(self, file_path_or_s3_key: str, is_s3: bool = False) -> Dict[str, Any]:
        """
        Main parse method that detects file type and calls appropriate parser

        Args:
            file_path_or_s3_key: Local file path or S3 key
            is_s3: True if file_path_or_s3_key is an S3 key, False for local file

        Returns:
            Parsed BRD data
        """
        if is_s3:
            if not self.s3_storage:
                raise ValueError("S3Storage not configured but is_s3=True")

            # Download file from S3 to temporary location
            file_content = self.s3_storage.download_brd(file_path_or_s3_key)

            # Determine file extension from S3 key
            file_extension = os.path.splitext(file_path_or_s3_key)[1]

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name

            try:
                # Parse the temporary file
                if file_extension == '.docx':
                    return self.parse_docx(temp_path)
                elif file_extension == '.txt':
                    return self.parse_txt(temp_path)
                else:
                    raise ValueError(f"Unsupported file format: {file_extension}")
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
        else:
            # Parse local file directly
            if file_path_or_s3_key.endswith('.docx'):
                return self.parse_docx(file_path_or_s3_key)
            elif file_path_or_s3_key.endswith('.txt'):
                return self.parse_txt(file_path_or_s3_key)
            else:
                raise ValueError(f"Unsupported file format: {file_path_or_s3_key}")
