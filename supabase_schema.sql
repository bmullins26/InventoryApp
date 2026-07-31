-- Inventory IQ v4.0 Multi-Tenant Schema (Supabase/PostgreSQL)

-- 1. Organizations (The Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- Short code like 'FREDS' for employee login
    created_at TIMESTAMPTZ DEFAULT NOW(),
    owner_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- 2. Branding Settings
CREATE TABLE branding_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    primary_color TEXT DEFAULT '#0056B3',
    secondary_color TEXT DEFAULT '#003E82',
    accent_color TEXT DEFAULT '#FFC72C',
    dark_mode BOOLEAN DEFAULT FALSE,
    sidebar_style TEXT DEFAULT 'modern',
    app_name TEXT DEFAULT 'Inventory IQ',
    logo_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Roles and Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE, -- To prevent deletion of Owner/Manager roles
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    resource TEXT NOT NULL, -- e.g., 'inventory', 'users'
    action TEXT NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete'
    UNIQUE(role_id, resource, action)
);

-- 4. Profiles (Authenticated Owners/Managers)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id),
    role_id UUID REFERENCES roles(id),
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Employees (PIN-based login, no email)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id),
    full_name TEXT NOT NULL,
    pin TEXT NOT NULL, -- Store as hashed in production, plaintext for foundation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 6. Locations
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Multi-tenant Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0.00,
    location_id UUID REFERENCES locations(id),
    manufacturer_barcode TEXT,
    internal_barcode TEXT,
    barcode_type TEXT,
    barcode_source TEXT,
    last_scanned TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Transaction History
CREATE TABLE history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID, -- We keep ID even if item deleted
    product_name TEXT,
    type TEXT NOT NULL,
    prev_qty INTEGER,
    change INTEGER,
    new_qty INTEGER,
    user_name TEXT, -- User display name
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY: Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- EXAMPLE RLS POLICIES (Simplified)
-- Everyone can only see records matching their org_id
CREATE POLICY "Tenant isolation" ON inventory
    USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation history" ON history
    USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
