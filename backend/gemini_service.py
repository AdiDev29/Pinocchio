import os
import json
import re
from google import genai
from google.genai.types import Tool, GoogleSearch
from google.genai.types import GenerateContentConfig
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure the Gemini API client
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")

# Initialize the client with API key
client = genai.Client(api_key=GEMINI_API_KEY)


def analyze_website_content(url, content):
    """
    Analyze website content using Gemini 2.0 with Google Search grounding.

    Args:
        url (str): The URL of the website
        content (str): The text content of the website

    Returns:
        dict: Analysis results including misinformation report and score
    """
    try:
        # Truncate content if it's too long
        max_content_length = 10000  # Adjust based on Gemini's token limits
        truncated_content = content[:max_content_length] if len(content) > max_content_length else content

        # Set up the Google Search tool
        google_search_tool = Tool(
            google_search=GoogleSearch()
        )

        # Create the prompt
        prompt = f"""
        I need to analyze the following website content for potential misinformation.

        URL: {url}

        CONTENT EXCERPT:
        {truncated_content}

        Please analyze this content and:
        1. Compare it with other authoritative sources using Google Search
        2. Identify any potential misinformation or inaccuracies
        3. Provide additional context about the topic
        4. Assign a misinformation score from 0 to 10, where 0 means completely accurate and 10 means highly misleading
        5. List the specific sources (URLs) you used for verification

        Format your response as JSON with the following structure:
        {{
            "summary": "Brief summary of the content (max 50 words)",
            "misinformation_detected": true or false,
            "misinformation_score": a number from 0 to 10,
            "report": "Detailed report comparing this content with other sources (max 250 words)",
            "additional_context": "Additional context about the topic (max 50 words)",
            "sources": ["source1_url", "source2_url", "source3_url"]
        }}

        Ensure your total response is under 300 words.
        """

        # Generate content with Google Search grounding using the recommended approach
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )

        # Extract text from response
        text_response = ""
        if hasattr(response, 'candidates') and len(response.candidates) > 0:
            if hasattr(response.candidates[0], 'content') and hasattr(response.candidates[0].content, 'parts'):
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text'):
                        text_response += part.text

        # Extract sources if available
        sources = []
        try:
            if (hasattr(response, 'candidates') and
                    len(response.candidates) > 0 and
                    hasattr(response.candidates[0], 'grounding_metadata')):

                grounding_metadata = response.candidates[0].grounding_metadata

                # Try to get sources from groundingChunks
                if hasattr(grounding_metadata, 'groundingChunks'):
                    for chunk in grounding_metadata.groundingChunks:
                        if hasattr(chunk, 'web') and hasattr(chunk.web, 'uri'):
                            title = chunk.web.title if hasattr(chunk.web, 'title') else "Source"
                            url = chunk.web.uri
                            sources.append({
                                'url': url,
                                'title': title
                            })
        except Exception as e:
            print(f"Error extracting sources from grounding metadata: {str(e)}")

        # Try to parse JSON from the response text
        result = {}
        try:
            # Try to find JSON in the response
            json_match = re.search(r'```json\s*(.*?)\s*```', text_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If no JSON block, try to find the whole JSON structure
                json_match = re.search(r'({.*})', text_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    # If still no JSON found, use the whole response
                    json_str = text_response

            # Clean up the json string to handle potential issues
            json_str = json_str.strip()
            result = json.loads(json_str)
        except Exception as e:
            print(f"Error parsing JSON from response: {str(e)}")
            # Create a basic structure if JSON parsing fails
            result = {
                "summary": text_response[:100] + "..." if len(text_response) > 100 else text_response,
                "misinformation_detected": None,
                "misinformation_score": 5,
                "report": text_response,
                "additional_context": "Error parsing structured data from the response.",
                "sources": []
            }

        # Add sources to result if they're not already included
        if 'sources' not in result or not result['sources']:
            result['sources'] = [s['url'] for s in sources] if sources else []

        # Include full source objects with titles
        result['source_objects'] = sources

        # Ensure all expected fields are present
        expected_fields = ['summary', 'misinformation_detected', 'misinformation_score', 'report', 'additional_context',
                           'sources']
        for field in expected_fields:
            if field not in result:
                if field == 'sources':
                    result[field] = []
                else:
                    result[field] = None

        return result

    except Exception as e:
        print(f"Error in analyze_website_content: {str(e)}")
        # Return a structured error response
        return {
            "error": f"Analysis failed: {str(e)}",
            "summary": "Could not analyze the content",
            "misinformation_detected": None,
            "misinformation_score": 5,  # Neutral score
            "report": "The system encountered an error while analyzing this content. Please try again later.",
            "additional_context": "Error processing the content",
            "sources": []
        }