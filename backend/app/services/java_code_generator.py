"""
Java Selenium + Cucumber Code Generation Utilities
Intelligent inference of Page Object Model and Glue Code from tests
"""

from typing import List, Dict, Set, Tuple
import re
from app.models import FunctionalTest, GherkinScenario, Entity


class JavaCodeGenerator:
    """Generates Java Selenium test automation code with intelligent POM inference"""

    def __init__(self, project_name: str, base_package: str = "com.cacib"):
        self.project_name = self._to_camel_case(project_name)
        self.base_package = f"{base_package}.{self._to_package_name(project_name)}"

    @staticmethod
    def _to_camel_case(text: str) -> str:
        """Convert text to CamelCase"""
        words = re.sub(r'[^a-zA-Z0-9\s]', '', text).split()
        return ''.join(word.capitalize() for word in words)

    @staticmethod
    def _to_package_name(text: str) -> str:
        """Convert text to package name (lowercase, no special chars)"""
        return re.sub(r'[^a-z0-9]', '', text.lower())

    @staticmethod
    def _to_snake_case(text: str) -> str:
        """Convert text to snake_case"""
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        text = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', text)
        return '_'.join(text.lower().split())

    def infer_page_objects_from_functional_tests(
        self,
        functional_tests: List[FunctionalTest]
    ) -> Dict[str, Dict[str, List[str]]]:
        """
        Intelligently infer Page Object Model structure from functional tests

        Returns:
            {
                "LoginPage": {
                    "elements": ["emailField", "passwordField", "loginButton"],
                    "actions": ["login", "enterEmail", "enterPassword"]
                },
                ...
            }
        """
        page_objects = {}

        for test in functional_tests:
            # Extract page names from test title and steps
            pages = self._extract_pages_from_test(test)

            for page_name in pages:
                if page_name not in page_objects:
                    page_objects[page_name] = {
                        "elements": set(),
                        "actions": set()
                    }

                # Extract elements and actions from test steps
                elements, actions = self._extract_elements_and_actions(test.test_steps, page_name)
                page_objects[page_name]["elements"].update(elements)
                page_objects[page_name]["actions"].update(actions)

        # Convert sets to lists for JSON serialization
        return {
            page: {
                "elements": list(data["elements"]),
                "actions": list(data["actions"])
            }
            for page, data in page_objects.items()
        }

    def _extract_pages_from_test(self, test: FunctionalTest) -> Set[str]:
        """Extract page names from test title and steps"""
        pages = set()

        # Common page keywords
        page_keywords = [
            'login', 'dashboard', 'home', 'profile', 'settings', 'product',
            'cart', 'checkout', 'payment', 'registration', 'signup', 'details'
        ]

        # Check test title
        title_lower = test.title.lower()
        for keyword in page_keywords:
            if keyword in title_lower:
                pages.add(f"{self._to_camel_case(keyword)}Page")

        # Check test steps
        for step in test.test_steps:
            step_lower = step.lower()
            if 'navigate' in step_lower or 'go to' in step_lower or 'open' in step_lower:
                for keyword in page_keywords:
                    if keyword in step_lower:
                        pages.add(f"{self._to_camel_case(keyword)}Page")

        # Default to a generic page if nothing found
        if not pages:
            pages.add("MainPage")

        return pages

    def _extract_elements_and_actions(
        self,
        test_steps: List[str],
        page_name: str
    ) -> Tuple[Set[str], Set[str]]:
        """Extract UI elements and actions from test steps"""
        elements = set()
        actions = set()

        # Element keywords
        element_patterns = {
            r'enter.*in\s+(\w+)\s+(field|input|box)': 'Field',
            r'click.*(\w+)\s+button': 'Button',
            r'select.*from\s+(\w+)\s+(dropdown|list)': 'Dropdown',
            r'check.*(\w+)\s+checkbox': 'Checkbox',
            r'upload.*to\s+(\w+)': 'FileInput',
            r'(\w+)\s+link': 'Link',
            r'(\w+)\s+icon': 'Icon',
            r'(\w+)\s+label': 'Label',
            r'(\w+)\s+text': 'Text'
        }

        for step in test_steps:
            step_lower = step.lower()

            # Extract elements
            for pattern, suffix in element_patterns.items():
                matches = re.finditer(pattern, step_lower)
                for match in matches:
                    element_name = match.group(1)
                    camel_name = self._to_camel_case(element_name)
                    elements.add(f"{camel_name[0].lower()}{camel_name[1:]}{suffix}")

            # Extract actions (verbs at the beginning of steps)
            if 'enter' in step_lower or 'type' in step_lower or 'input' in step_lower:
                actions.add('enter')
            if 'click' in step_lower or 'press' in step_lower:
                actions.add('click')
            if 'select' in step_lower or 'choose' in step_lower:
                actions.add('select')
            if 'navigate' in step_lower or 'go to' in step_lower:
                actions.add('navigate')
            if 'verify' in step_lower or 'check' in step_lower or 'assert' in step_lower:
                actions.add('verify')
            if 'upload' in step_lower:
                actions.add('upload')
            if 'submit' in step_lower:
                actions.add('submit')

        return elements, actions

    def extract_gherkin_steps_mapping(
        self,
        gherkin_tests: List[GherkinScenario]
    ) -> Dict[str, Set[str]]:
        """
        Extract unique Gherkin steps for glue code generation

        Returns:
            {
                "given": {"I am on the login page", "I am logged in as {string}"},
                "when": {"I enter email {string} and password {string}"},
                "then": {"I should see the dashboard", "I should see error message {string}"}
            }
        """
        steps_mapping = {
            "given": set(),
            "when": set(),
            "then": set()
        }

        for scenario in gherkin_tests:
            steps_mapping["given"].update(scenario.given)
            steps_mapping["when"].update(scenario.when)
            steps_mapping["then"].update(scenario.then)

        return {
            key: list(steps) for key, steps in steps_mapping.items()
        }

    def generate_step_definition_method(
        self,
        step_type: str,
        step_text: str
    ) -> Dict[str, str]:
        """
        Generate a Java step definition method from a Gherkin step

        Returns:
            {
                "annotation": "@Given(\"I am on the login page\")",
                "method_name": "i_am_on_the_login_page",
                "method_signature": "public void i_am_on_the_login_page()"
            }
        """
        # Extract parameters from step text
        param_pattern = r'\{string\}|\{int\}|\{double\}'
        params = re.findall(param_pattern, step_text)

        # Replace parameters with regex for Cucumber annotation
        step_regex = step_text
        for i, param_type in enumerate(params):
            if param_type == '{string}':
                step_regex = step_regex.replace(param_type, '\"([^\"]*)\"', 1)
            elif param_type == '{int}':
                step_regex = step_regex.replace(param_type, '(\\d+)', 1)
            elif param_type == '{double}':
                step_regex = step_regex.replace(param_type, '(\\d+\\.\\d+)', 1)

        # Generate method name
        method_name = self._to_snake_case(step_text)
        method_name = re.sub(r'\{.*?\}', '', method_name)  # Remove parameter placeholders
        method_name = re.sub(r'[^a-z0-9_]', '_', method_name)
        method_name = re.sub(r'_+', '_', method_name).strip('_')

        # Generate method parameters
        java_params = []
        for i, param_type in enumerate(params):
            if param_type == '{string}':
                java_params.append(f"String param{i+1}")
            elif param_type == '{int}':
                java_params.append(f"int param{i+1}")
            elif param_type == '{double}':
                java_params.append(f"double param{i+1}")

        params_str = ", ".join(java_params) if java_params else ""

        return {
            "annotation": f"@{step_type.capitalize()}(\"{step_regex}\")",
            "method_name": method_name,
            "method_signature": f"public void {method_name}({params_str})",
            "has_params": len(java_params) > 0
        }

    def infer_page_for_step(self, step_text: str) -> str:
        """Infer which page object a Gherkin step refers to"""
        step_lower = step_text.lower()

        page_mapping = {
            'login': 'LoginPage',
            'dashboard': 'DashboardPage',
            'home': 'HomePage',
            'profile': 'ProfilePage',
            'product': 'ProductPage',
            'cart': 'CartPage',
            'checkout': 'CheckoutPage',
            'settings': 'SettingsPage',
            'registration': 'RegistrationPage',
            'signup': 'SignupPage'
        }

        for keyword, page_name in page_mapping.items():
            if keyword in step_lower:
                return page_name

        return "BasePage"  # Default fallback
