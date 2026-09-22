-- 1. Create Organizations table (e.g., Reliance Group)
CREATE TABLE public.organizations (
  organization_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (organization_id)
);

-- 2. Create Tenants table (e.g., Reliance Smart, Trends, Fresh)
CREATE TABLE public.tenants (
  tenant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tenant_name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenants_pkey PRIMARY KEY (tenant_id),
  CONSTRAINT fk_tenant_org FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE CASCADE
);

-- 3. Add tenant_id to stores table
ALTER TABLE public.stores
ADD COLUMN tenant_id uuid,
ADD CONSTRAINT fk_stores_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);

-- Optional: If you want to link specific admin users to an organization or tenant directly
ALTER TABLE public.users
ADD COLUMN organization_id uuid,
ADD COLUMN tenant_id uuid,
ADD CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);

-- Example Data Insert (Optional)
-- INSERT INTO public.organizations (name) VALUES ('Reliance Group');
-- INSERT INTO public.tenants (organization_id, tenant_name) VALUES ((SELECT organization_id FROM public.organizations LIMIT 1), 'Reliance Smart');

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 5. Add default RLS Policies (Allow authenticated users to read, service_role handles inserts)
CREATE POLICY "Allow authenticated users to read organizations" ON public.organizations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read tenants" ON public.tenants
  FOR SELECT TO authenticated USING (true);
