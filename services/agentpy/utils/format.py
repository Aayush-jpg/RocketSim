"""Response formatting utilities."""

import re

def format_response(text: str) -> str:
    """
    Format the agent's response as clean markdown with comprehensive formatting fixes.
    
    Args:
        text: Raw text from the agent
        
    Returns:
        str: Clean markdown text for the frontend to render
    """
    text = text.strip()
    
    # Remove the current rocket JSON context that shouldn't be displayed
    text = re.sub(r'CURRENT_ROCKET_JSON:?\s*```json\s*\{.*?\}\s*```', '', text, flags=re.DOTALL)
    
    # Handle action responses - convert raw JSON to human-readable text
    text = re.sub(r'```json\s*\{"action":\s*"run_simulation"[^}]*\}\s*```', '✅ Simulation completed successfully!', text)
    text = re.sub(r'\{"action":\s*"run_simulation"[^}]*\}', '🚀 Running simulation...', text)
    
    text = re.sub(r'```json\s*\{"action":\s*"add_part"[^}]*\}\s*```', '🔧 Adding new rocket component...', text)
    text = re.sub(r'\{"action":\s*"add_part"[^}]*\}', '🔧 Adding new rocket component...', text)
    
    text = re.sub(r'```json\s*\{"action":\s*"update_part"[^}]*\}\s*```', '⚙️ Updating rocket component...', text)
    text = re.sub(r'\{"action":\s*"update_part"[^}]*\}', '⚙️ Updating rocket component...', text)
    
    # Remove any remaining standalone JSON action objects
    text = re.sub(r'\{"action":[^}]+\}', '', text)
    
    # Clean up simulation results headers that appear with JSON
    text = re.sub(r'Simulation Results\s*\{"action"[^}]+\}', '✅ Simulation completed successfully!', text)
    text = re.sub(r'Simulation Results\s*$', '✅ Simulation completed!', text, flags=re.MULTILINE)
    
    # COMPREHENSIVE BULLET POINT FIXES
    # Fix bullet points that are separated from their content
    lines = text.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        current_line = lines[i].strip()
        next_line = lines[i + 1].strip() if i + 1 < len(lines) else ''
        
        # Check for bullet on one line and content on the next
        if re.match(r'^[\*\-\+]\s*$', current_line) and next_line and not re.match(r'^[\*\-\+]', next_line):
            # Merge bullet with next line
            fixed_lines.append(f'* {next_line}')
            i += 2
        elif re.match(r'^\d+\.\s*$', current_line) and next_line and not re.match(r'^\d+\.', next_line):
            # Merge numbered list item with next line
            fixed_lines.append(f'{current_line} {next_line}')
            i += 2
        else:
            if current_line:  # Only add non-empty lines
                fixed_lines.append(current_line)
            i += 1
    
    text = '\n'.join(fixed_lines)
    
    # Additional bullet point formatting fixes
    text = re.sub(r'^\*\s*\n(.+)', r'* \1', text, flags=re.MULTILINE)
    text = re.sub(r'^-\s*\n(.+)', r'- \1', text, flags=re.MULTILINE)
    text = re.sub(r'^\+\s*\n(.+)', r'+ \1', text, flags=re.MULTILINE)
    text = re.sub(r'^(\d+)\.\s*\n(.+)', r'\1. \2', text, flags=re.MULTILINE)
    
    # Fix LaTeX spacing issues
    text = re.sub(r'\$\s+', '$', text)  # Remove spaces after opening $
    text = re.sub(r'\s+\$', '$', text)  # Remove spaces before closing $
    text = re.sub(r'\$\$\s+', '$$', text)  # Remove spaces after opening $$
    text = re.sub(r'\s+\$\$', '$$', text)  # Remove spaces before closing $$
    
    # ENHANCED: Ensure any mathematical expressions without delimiters are properly wrapped
    # This is a safety net in case the AI occasionally misses formatting
    # Look for common LaTeX patterns that might not be wrapped
    lines = text.split('\n')
    processed_lines = []
    
    for line in lines:
        # Skip lines that already have math delimiters
        if '$' in line:
            processed_lines.append(line)
            continue
            
        # Check for obvious LaTeX expressions that need wrapping
        if re.search(r'\\(frac|text|mathbf)\{[^}]+\}', line.strip()):
            # This appears to be a mathematical expression - wrap it
            if '=' in line and any(cmd in line for cmd in ['\\frac', '\\text', '\\mathbf']):
                # Likely a mathematical equation
                processed_lines.append(f'$${line.strip()}$$')
            else:
                # Likely inline math
                processed_lines.append(f'${line.strip()}$')
        else:
            processed_lines.append(line)
    
    text = '\n'.join(processed_lines)
    
    # Ensure proper spacing for markdown elements
    text = re.sub(r'\n{3,}(#{1,6})', r'\n\n\1', text)
    text = re.sub(r'(#{1,6}[^\n]+)\n{3,}', r'\1\n\n', text)
    
    # Fix code block spacing
    text = re.sub(r'(?<!\n)\n```', r'\n\n```', text)
    text = re.sub(r'```\n(?!\n)', r'```\n\n', text)
    
    # Fix list spacing - ensure lists are properly separated
    text = re.sub(r'(?<!\n)\n([\*\-\+]\s)', r'\n\n\1', text)
    text = re.sub(r'(?<!\n)\n(\d+\.\s)', r'\n\n\1', text)
    
    # Add language identifiers to code blocks for better syntax highlighting
    if 'json' in text.lower() and '```\n{' in text:
        text = re.sub(r'```\n(\{[^`]+\})', r'```json\n\1', text)
    if 'python' in text.lower() and '```\ndef ' in text:
        text = re.sub(r'```\n(def [^`]+)', r'```python\n\1', text)
    
    # Ensure proper line spacing between different markdown elements
    lines = text.split('\n')
    formatted_lines = []
    prev_line_type = None
    
    for line in lines:
        line = line.strip()
        if not line:
            formatted_lines.append('')
            continue
        
        current_line_type = 'paragraph'
        if line.startswith('#'): 
            current_line_type = 'heading'
        elif line.startswith('```'): 
            current_line_type = 'code_block'
        elif re.match(r'^[\*\-\+]\s', line): 
            current_line_type = 'bullet_list'
        elif re.match(r'^\d+\.\s', line): 
            current_line_type = 'numbered_list'
        elif line.startswith('|') and '|' in line[1:]: 
            current_line_type = 'table'
        
        # Add spacing between different types of content
        if prev_line_type and current_line_type != prev_line_type:
            if formatted_lines and formatted_lines[-1] != '':
                formatted_lines.append('')
        
        formatted_lines.append(line)
        prev_line_type = current_line_type
    
    result = '\n'.join(formatted_lines)
    
    # Final cleanup - remove excessive empty lines but preserve structure
    result = re.sub(r'\n{4,}', '\n\n\n', result)
    result = result.strip()
    
    return result 