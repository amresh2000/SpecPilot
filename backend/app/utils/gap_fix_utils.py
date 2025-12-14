"""
Utility functions for handling gap fixes
Eliminates code duplication across endpoints
"""

from typing import List, Dict
from app.models import GapFix


def extract_applied_gap_fixes(gap_fixes: List[GapFix]) -> List[Dict]:
    """
    Extract gap fixes that user accepted or edited

    Args:
        gap_fixes: List of GapFix objects from job results

    Returns:
        List of dictionaries with type, issue, and correction
    """
    applied = []

    if not gap_fixes:
        return applied

    for gf in gap_fixes:
        if gf.user_action == "accepted":
            applied.append({
                "type": gf.gap_description,
                "issue": gf.affected_section,
                "correction": gf.suggested_fix
            })
        elif gf.user_action == "edited" and gf.final_text:
            applied.append({
                "type": gf.gap_description,
                "issue": gf.affected_section,
                "correction": gf.final_text
            })

    return applied
