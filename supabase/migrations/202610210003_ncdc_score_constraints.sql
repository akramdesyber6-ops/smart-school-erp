-- Enforce the NCDC component point ranges on every new insert/update.
-- NOT VALID leaves pre-existing rows untouched while immediately checking new writes;
-- validate these constraints after auditing any legacy score data.
begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'markbook_bot_score_range_check'
      and conrelid = 'public.markbook_entries'::regclass
  ) then
    alter table public.markbook_entries
      add constraint markbook_bot_score_range_check
      check (bot_score is null or bot_score between 0 and 10) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'markbook_mot_score_range_check'
      and conrelid = 'public.markbook_entries'::regclass
  ) then
    alter table public.markbook_entries
      add constraint markbook_mot_score_range_check
      check (mot_score is null or mot_score between 0 and 20) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'markbook_eot_score_range_check'
      and conrelid = 'public.markbook_entries'::regclass
  ) then
    alter table public.markbook_entries
      add constraint markbook_eot_score_range_check
      check (eot_score is null or eot_score between 0 and 70) not valid;
  end if;
end;
$$;

commit;
