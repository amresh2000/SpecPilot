import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Centralized configuration management"""

    # AWS Bedrock Configuration
    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_BEDROCK_MODEL_ID = os.getenv("AWS_BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
    
    # Proxy Configuration (auto-applied by boto3 and requests)
    HTTP_PROXY = os.getenv("HTTP_PROXY")
    HTTPS_PROXY = os.getenv("HTTPS_PROXY")
    NO_PROXY = os.getenv("NO_PROXY")
    
    # Jira Configuration (Optional)
    JIRA_URL = os.getenv("JIRA_URL")
    JIRA_EMAIL = os.getenv("JIRA_EMAIL")
    JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
    JIRA_PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY")
    JIRA_EPIC_NAME_FIELD = os.getenv("JIRA_EPIC_NAME_FIELD", "customfield_10011")
    JIRA_EPIC_LINK_FIELD = os.getenv("JIRA_EPIC_LINK_FIELD", "customfield_10014")
    
    # SSL Configuration (Optional)
    REQUESTS_CA_BUNDLE = os.getenv("REQUESTS_CA_BUNDLE")
    SSL_VERIFY = os.getenv("SSL_VERIFY", "true").lower() == "true"
    
    # Application Settings
    PORT = int(os.getenv("PORT", "8000"))
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []
        
        if not cls.AWS_ACCESS_KEY_ID:
            errors.append("AWS_ACCESS_KEY_ID is required")
        if not cls.AWS_SECRET_ACCESS_KEY:
            errors.append("AWS_SECRET_ACCESS_KEY is required")
        
        if errors:
            raise ValueError(f"Configuration errors: {errors}")
        
        return True

config = Config()
