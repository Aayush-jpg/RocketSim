"""Response formatting utilities."""

import re

def format_response(text: str) -> str:
    """
    Format the agent's response for better readability.
    
    Args:
        text: Raw text from the agent
        
    Returns:
        str: Formatted HTML text for the frontend
    """
    # Remove any existing HTML tags for safety (avoid duplicating formatting)
    text = re.sub(r'<\/?[^>]+>', '', text)
    
    # Remove the CURRENT_ROCKET_JSON block from responses if it's included
    text = re.sub(r'CURRENT_ROCKET_JSON:?\s*```json\s*\{.*?\}\s*```', '', text, flags=re.DOTALL)
    
    # 1. Format tables first as they are distinct blocks
    if '|' in text and re.search(r'\|[^|]+\|[^|]+\|', text):
        table_sections = re.finditer(r'([^\n]*\|[^\n]*\n){2,}', text)
        for section in table_sections:
            # Process table content here (same as before)
            table_html = '<div class="table-wrapper"><table class="data-table">'
            rows = section.group(0).strip().split('\n')
            has_header = len(rows) > 1 and re.match(r'\s*\|[\s\-:]+\|[\s\-:]+\|', rows[1])
            for i, row_text in enumerate(rows):
                if i == 1 and has_header: continue
                if row_text.strip():
                    cells = [cell.strip() for cell in row_text.strip().split('|') if cell.strip()]
                    row_html_tag = '<tr>'
                    for cell_text in cells:
                        tag = 'th' if (i == 0 and has_header) else 'td'
                        row_html_tag += f'<{tag}>{cell_text}</{tag}>'
                    row_html_tag += '</tr>'
                    table_html += row_html_tag
            table_html += '</table></div>'
            text = text.replace(section.group(0), table_html)

    # 2. Format headings
    text = re.sub(r'^###\s+(.+?)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
    text = re.sub(r'^##\s+(.+?)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
    text = re.sub(r'^#\s+(.+?)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)

    # 3. Format numbered lists (e.g., 1. **Title**: Content)
    def replace_numbered_list(match_obj):
        list_block = match_obj.group(1)
        items_html = []
        item_pattern = r'^(\d+)\.\s+\*\*(.+?)\*\*(?::|\.|\s+)(.+?)$'
        for line in list_block.strip().split('\n'):
            item_match = re.match(item_pattern, line.strip())
            if item_match:
                num, title, content = item_match.groups()
                items_html.append(f'<div class="step-item"><span class="step-number">{num}</span><strong>{title.strip()}</strong> {content.strip()}</div>')
        if not items_html:
            return match_obj.group(0) # Return original if no items matched (should not happen with outer pattern)
        return f'<div class="steps-container">{"".join(items_html)}</div>'
    
    numbered_list_block_pattern = r'(^(?:\d+\.\s+\*\*.*?\*\*(?::|\.|\s+).*?(?:\n|$))+)'
    text = re.sub(numbered_list_block_pattern, replace_numbered_list, text, flags=re.MULTILINE)

    # 4. Format bulleted lists (e.g., - Item content or * Item content)
    def replace_bulleted_list(match_obj):
        list_block = match_obj.group(1)
        items_html = []
        # Handle both '*' and '-' as bullets, also allow for optional '**bold**' content start
        item_pattern = r'^[\*\-]\s+(?:\*\*(.+?)\*\*\s*)?(.*)$'
        for line in list_block.strip().split('\n'):
            item_match = re.match(item_pattern, line.strip())
            if item_match:
                bold_part, rest_part = item_match.groups()
                content = ""
                if bold_part:
                    content += f'<strong>{bold_part.strip()}</strong> '
                content += rest_part.strip()
                items_html.append(f'<div class="bullet-item">{content}</div>')
        if not items_html:
             return match_obj.group(0)
        return f'<div class="bullet-list-container">{"".join(items_html)}</div>'

    bullet_list_block_pattern = r'(^(?:[\*\-]\s+.*?(?:\n|$))+)'
    text = re.sub(bullet_list_block_pattern, replace_bulleted_list, text, flags=re.MULTILINE)
    
    # 5. Format data presentations (e.g., "Your current X is Y")
    text = re.sub(r'Your (current|rocket\'s) (\w+) is ([^\n\.]+)\.?',
                r'Your \1 <strong>\2</strong> is <span class="highlight-value">\3</span>.', text)
    text = re.sub(r'The current ([a-z\s]+) is ([^\n\.]+)\.?',
                 r'The current <strong>\1</strong> is <span class="highlight-value">\2</span>.', text)

    # 6. Format bold and italic text (must come after list processing that uses similar markdown)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    
    # 7. Format code blocks and inline code
    text = re.sub(r'```(\w*)\n(.*?)\n```', r'<pre class="code-block \1">\2</pre>', text, flags=re.DOTALL)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    
    # 8. Format paragraphs (final step)
    paragraphs = []
    # Split by double newlines, or single if it's likely a new paragraph start
    chunks = re.split(r'\n\s*\n|(?<!\n)\n(?!<(?:div|h[1-6]|pre|table|ul|li))', text) 
    for chunk in chunks:
        if chunk is None or not chunk.strip():
            continue
        # Skip wrapping if chunk already IS a block-level HTML element
        if re.match(r'^\s*<(div|h[1-6]|pre|table|ul|li)', chunk.strip(), re.IGNORECASE):
            paragraphs.append(chunk.strip())
        else:
            paragraphs.append(f'<p>{chunk.strip()}</p>') # Wrap in paragraph tags
    
    return '\n'.join(paragraphs) 