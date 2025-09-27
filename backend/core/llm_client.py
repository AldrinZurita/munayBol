import requests

def get_llm_response(prompt):
    response = requests.post('http://llm:5000/generate', json={'prompt': prompt})
    return response.json()['result']