import logging
from services.comprehend_medical import detect_entities, detect_medical_context
from services.bedrock_claude import call_claude
from services.input_validate import analyze_message
from triaje_classification import TriageClassification
from context_manager import init_context

class ChatbotInit:

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    
    def initialize_convesation(self, initial_message):

        try:
            entities = detect_entities(initial_message)
            context_initial = init_context(initial_message)
            context = context_initial['context']
            missing_questions = context_initial['missing_questions']

            symptoms = []

            try:
                