-- Allow multiple residents/contacts for the same plot number
alter table public.dataset_entries
  drop constraint if exists dataset_entries_plot_number_key;
