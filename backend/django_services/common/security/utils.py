from html_sanitizer.django import get_sanitizer

def sanitize_input(input):

    if isinstance(input, str):
        sanitizer = get_sanitizer()
        return sanitizer.sanitize(input)
    return input

