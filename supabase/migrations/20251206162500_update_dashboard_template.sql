-- Update the 'dashboard_message' template to be more flexible and include variables
DELETE FROM whatsapp_message_templates WHERE template_type = 'dashboard_message';

INSERT INTO whatsapp_message_templates (template_type, message_content, variables, active)
VALUES (
    'dashboard_message',
    '📱 *Mensagem do Dashboard*

{mensagem}

_Enviado por: {remetente}_',
    '["mensagem", "remetente"]'::jsonb,
    true
);
