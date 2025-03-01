#!/usr/bin/env python3
"""
Test script for troubleshooting Gemini API functionality with Google Search grounding.
This performs the same content analysis as app.py but without the Flask server.
"""

import os
import json
import sys
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variables
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY environment variable not set. Please set it in .env file.")
    exit(1)

print(f"Using API key starting with: {API_KEY[:5]}...")

# Set API key in a way that should work for all versions
try:
    # Try setting api_key directly if available
    genai.api_key = API_KEY
    print("Set API key using genai.api_key")
except:
    pass

# Also set it as an environment variable as a backup
os.environ["GOOGLE_API_KEY"] = API_KEY
print("Also set GOOGLE_API_KEY environment variable")

# Print library version for debugging
print(f"Google Generative AI library version: {genai.__version__ if hasattr(genai, '__version__') else 'unknown'}")


def analyze_content(content_data):
    """
    Analyze webpage content using Gemini API with Google Search grounding
    This function replicates the analyze_content() endpoint in app.py
    """
    # Build the content summary
    content_summary = f"""
    URL: {content_data.get('url', 'Not provided')}
    Title: {content_data.get('title', 'Not provided')}
    Main Heading: {content_data.get('heading', 'Not provided')}
    Description: {content_data.get('description', 'Not provided')}

    Content Summary:
    {content_data.get('content', 'Not provided')[:2500]}
    """

    print("\n------ CONTENT TO ANALYZE ------")
    print(content_summary[:500] + "..." if len(content_summary) > 500 else content_summary)
    print("--------------------------------\n")

    try:
        # Create a model instance
        print("Creating Gemini model instance...")
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Prepare the prompt
        prompt = f"""You are a fact-checking assistant. Analyze this web content for factual accuracy and potential misinformation. 
        Research the claims using reliable sources.

        Provide a concise factual assessment (max 250 words) that:
        1. Summarizes the key claims or information from the content
        2. Compares with information from trusted sources
        3. Identifies any potential misinformation, misleading statements, or factual errors
        4. Provides essential context to understand the topic correctly

        Format your response in easy-to-read paragraphs with a final verdict rating the content's overall reliability.

        Content to analyze:
        {content_summary}
        """

        print("Sending request to Gemini API...")

        # Basic call for testing connectivity first
        print("\nTrying basic API call first...")
        response = model.generate_content(prompt)
        print("Response received!")
        print(f"Response type: {type(response)}")
        print(f"Response attributes: {dir(response)}")
        print("\nBasic analysis result:")
        print(response.text[:500] + "..." if len(response.text) > 500 else response.text)

        print("\n------------------------------\n")

        # Now try with Google Search grounding
        print("Trying with Google Search grounding...")

        # Try different approaches based on possible API versions
        try:
            # Method 1: Using generation_config with search_queries parameter
            print("Method 1: Using generation_config with search_queries...")
            search_response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 1024,
                },
                # Try adding search_queries parameter
                search_queries=["factual analysis", content_data.get('title', '')]
            )
            print("Method 1 successful!")

        except (TypeError, AttributeError) as e:
            print(f"Method 1 failed: {e}")

            try:
                # Method 2: Using safety_settings and tools parameter
                print("Method 2: Using tools parameter...")
                search_response = model.generate_content(
                    prompt,
                    tools=[{"google_search": {}}]
                )
                print("Method 2 successful!")

            except (TypeError, AttributeError) as e:
                print(f"Method 2 failed: {e}")

                # Method 3: Using REST API for more direct control
                print("Method 3: Using direct REST API call...")
                import requests

                url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={API_KEY}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {
                                    "text": prompt
                                }
                            ]
                        }
                    ],
                    "tools": [
                        {
                            "googleSearchRetrieval": {}
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 1024
                    }
                }

                search_response_raw = requests.post(url, json=payload)
                if search_response_raw.ok:
                    print("Method 3 successful!")
                    search_result = search_response_raw.json()

                    # Create a simple object with text property to maintain compatibility
                    class SimpleResponse:
                        def __init__(self, text):
                            self.text = text

                    # Extract text from REST API response
                    try:
                        text = search_result["candidates"][0]["content"]["parts"][0]["text"]
                        search_response = SimpleResponse(text)
                    except (KeyError, IndexError):
                        # Fallback to the basic response
                        print("Could not extract text from REST API response, using basic response")
                        search_response = response
                else:
                    print(f"Method 3 failed: {search_response_raw.status_code} - {search_response_raw.text}")
                    # Fallback to the basic response
                    search_response = response

        print("\nAnalysis result with Google Search grounding:")
        search_text = search_response.text
        print(search_text[:500] + "..." if len(search_text) > 500 else search_text)

        # For a complete response, use the search-grounded response if we got one,
        # otherwise fall back to the basic response
        analysis_text = search_text if hasattr(search_response, 'text') else response.text

        # Sources remain empty for now since we can't reliably extract them yet
        return {
            'analysis': analysis_text,
            'sources': []
        }

    except Exception as e:
        print(f"Error analyzing content: {str(e)}")
        # Print stack trace for debugging
        import traceback
        traceback.print_exc()
        return {
            'error': f"Error analyzing content: {str(e)}"
        }


def main():
    """
    Main function to test the Gemini API functionality with Google Search grounding
    """
    # Sample webpage content for testing
    test_content = {
        'url': 'https://example.com/article',
        'title': 'Example Article About Climate Change',
        'heading': 'The Effects of Climate Change on Global Weather Patterns',
        'description': 'An examination of how climate change is affecting weather patterns around the world.',
        'content': """
        Climate change is having a profound impact on global weather patterns. Rising temperatures are leading to more frequent and severe heatwaves, droughts, and wildfires in many regions. At the same time, warmer air can hold more moisture, resulting in heavier rainfall and flooding in other areas.

        The Arctic is warming at a rate more than twice the global average, leading to rapid sea ice loss. This Arctic amplification may be disrupting the jet stream, causing it to meander more and potentially leading to more persistent weather patterns that can result in extreme events.

        Hurricane activity in the Atlantic has shown increasing trends in intensity, though the relationship with climate change is complex. Studies suggest that while the overall number of hurricanes may not increase, the proportion of major hurricanes (Category 3-5) is likely to rise, along with rainfall rates.

        Climate scientists have observed shifts in atmospheric circulation patterns, including expansion of the Hadley Cell and poleward migration of storm tracks. These changes affect precipitation patterns, potentially making dry areas drier and wet areas wetter.

        While weather and climate are distinct concepts—weather referring to short-term conditions and climate to long-term patterns—the increasing frequency of extreme weather events aligns with predictions from climate models. This suggests that the observed changes are not merely natural variability but are influenced by human-induced climate change.

        The IPCC's Sixth Assessment Report states with high confidence that human influence has warmed the climate at a rate unprecedented in at least the last 2000 years. This warming is already affecting weather and climate extremes in every region across the globe.

        Adaptation to these changing patterns will require significant infrastructure investments, particularly in vulnerable regions. Meanwhile, mitigation efforts to reduce greenhouse gas emissions remain crucial for limiting the extent of future changes.
        """
    }

    # Run the analysis
    print("Starting content analysis test with Google Search grounding...")
    result = analyze_content(test_content)

    # Print the result
    if 'error' in result:
        print(f"\nERROR: {result['error']}")
    else:
        print("\nFINAL ANALYSIS RESULT:")
        print(result['analysis'])

        print("\nSOURCES:")
        if result['sources']:
            for i, source in enumerate(result['sources'], 1):
                print(f"{i}. {source['title']}: {source['url']}")
        else:
            print("No sources available.")

    print("\nTest completed.")


if __name__ == "__main__":
    main()