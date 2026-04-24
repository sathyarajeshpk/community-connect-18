-- ============ PAYMENTS & PEOPLE MIGRATION ============

-- 1. Fix dataset_entries duplicates: keep only latest per plot_number
DELETE FROM public.dataset_entries a
  USING public.dataset_entries b
  WHERE a.plot_number = b.plot_number
    AND a.created_at < b.created_at;

-- 2. Add unique constraint on dataset_entries.plot_number (enables upsert)
ALTER TABLE public.dataset_entries
  ADD CONSTRAINT IF NOT EXISTS dataset_entries_plot_number_key UNIQUE (plot_number);

-- 3. Monthly maintenance amount setting
INSERT INTO public.settings (key, value)
VALUES ('monthly_amount', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Maintenance payments table
CREATE TABLE IF NOT EXISTS public.maintenance_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_number text NOT NULL,
  paid_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payer_name  text,
  amount      numeric(10,2) NOT NULL DEFAULT 0,
  month       text NOT NULL,          -- YYYY-MM
  utr_ref     text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at   timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS maintenance_payments_plot_idx  ON public.maintenance_payments (plot_number);
CREATE INDEX IF NOT EXISTS maintenance_payments_month_idx ON public.maintenance_payments (month);
CREATE INDEX IF NOT EXISTS maintenance_payments_payer_idx ON public.maintenance_payments (paid_by);

-- 5. RLS for maintenance_payments
CREATE POLICY "residents view own payments" ON public.maintenance_payments
  FOR SELECT TO authenticated USING (paid_by = auth.uid());

CREATE POLICY "admins view all payments" ON public.maintenance_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "residents insert own payments" ON public.maintenance_payments
  FOR INSERT TO authenticated WITH CHECK (paid_by = auth.uid());

CREATE POLICY "residents update own pending payments" ON public.maintenance_payments
  FOR UPDATE TO authenticated
  USING (paid_by = auth.uid() AND status = 'pending')
  WITH CHECK (paid_by = auth.uid());

CREATE POLICY "admins manage all payments" ON public.maintenance_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Function: admin confirms or rejects a payment
CREATE OR REPLACE FUNCTION public.confirm_payment(
  _payment_id uuid,
  _action     text DEFAULT 'confirm'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can confirm payments';
  END IF;
  UPDATE public.maintenance_payments
  SET status       = CASE WHEN _action = 'confirm' THEN 'confirmed'::text ELSE 'rejected'::text END,
      confirmed_by = auth.uid(),
      confirmed_at = now()
  WHERE id = _payment_id;
END;
$$;

-- 7. Allow admins to delete profiles (soft-delete / hard-delete for people mgmt)
-- Profiles already have admins update policy; add delete policy
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
