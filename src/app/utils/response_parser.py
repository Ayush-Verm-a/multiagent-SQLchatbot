import json

def parse_agent_response(response_text: str) -> dict:
    result = {
        "explanation": "",
        "query_result": None,
        "sql_query": None,
        "error": None,
        "suggestions": None,
        "structured_response": None
    }
    
    if not response_text:
        return result
    
    delimiters = ["<<<EXPLANATION>>>", "<<<QUERY_RESULT>>>", "<<<SQL>>>", "<<<ERROR>>>", "<<<SUGGESTIONS>>>", "<<<STRUCTURED_RESPONSE>>>", "<<<INVALID>>>", "<<<END>>>"]
    
    def get_section_content(marker):
        if marker not in response_text:
            return None
        start_index = response_text.find(marker) + len(marker)
        
        # Find the nearest next delimiter
        next_indices = [response_text.find(d, start_index) for d in delimiters if response_text.find(d, start_index) != -1]
        
        if next_indices:
            end_index = min(next_indices)
        else:
            end_index = len(response_text)
            
        content = response_text[start_index:end_index].strip()
        
        if content.startswith("```"):
            # Find the end of the opening marker (could be ```json or just ```)
            first_newline = content.find('\n')
            if first_newline != -1:
                # Remove the opening ``` or ```json line
                content = content[first_newline + 1:]
            
            # Remove the closing ``` if present
            if content.endswith("```"):
                content = content[:-3]
                
            content = content.strip()
            
        return content

    result["explanation"] = get_section_content("<<<EXPLANATION>>>") or ""
    query_result_raw = get_section_content("<<<QUERY_RESULT>>>")
    if query_result_raw:
        
        # Strip JavaScript-style comments (// ...) which are invalid in JSON
        # Some LLMs may add these despite instructions not to
        import re
        lines = query_result_raw.split('\n')
        cleaned_lines = []
        for line in lines:
            # Remove // comments but preserve strings that might contain //
            # Simple approach: if line contains // outside of quotes, remove from // onwards
            comment_idx = line.find('//')
            if comment_idx != -1:
                # Check if it's inside a string by counting quotes before it
                before_comment = line[:comment_idx]
                quote_count = before_comment.count('"') - before_comment.count('\\"')
                if quote_count % 2 == 0:  # Even number of quotes = not inside string
                    line = line[:comment_idx].rstrip()
                    if not line.strip() or line.strip() == ',':
                        continue  # Skip empty lines or lines with just comma
            cleaned_lines.append(line)
        
        query_result_raw = '\n'.join(cleaned_lines)
        
        # Try to validate it's valid JSON
        try:
            json.loads(query_result_raw)
        except json.JSONDecodeError as e:
            if e.pos < len(query_result_raw):
                start = max(0, e.pos - 50)
                end = min(len(query_result_raw), e.pos + 50)
    
    result["query_result"] = query_result_raw
    result["sql_query"] = get_section_content("<<<SQL>>>")
    result["error"] = get_section_content("<<<ERROR>>>") or get_section_content("<<<INVALID>>>")
    result["suggestions"] = get_section_content("<<<SUGGESTIONS>>>")
    result["structured_response"] = get_section_content("<<<STRUCTURED_RESPONSE>>>")
    
    return result