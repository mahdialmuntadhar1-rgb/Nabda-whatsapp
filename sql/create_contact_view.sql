-- Create view for frontend compatibility (aliases display_name as 'name')
CREATE OR REPLACE VIEW contact_view AS
SELECT 
    id,
    display_name as name,
    normalized_phone as phone,
    whatsapp_phone,
    governorate,
    category
FROM contacts;

-- Grant access to the view (if using RLS)
ALTER VIEW contact_view OWNER TO postgres;
