import logging

class CustomFormatter(logging.Formatter):
    def format(self, record):
        # Format name: app.utils.emails -> utils/emails
        name_parts = record.name.split('.')
        if name_parts[0] == 'app' and len(name_parts) > 1:
            mod_name = '/'.join(name_parts[1:])
        else:
            mod_name = record.name
            
        record.custom_prefix = f"[{mod_name}/{record.funcName}]"
        return super().format(record)

handler = logging.StreamHandler()
handler.setFormatter(CustomFormatter('%(custom_prefix)s %(message)s'))