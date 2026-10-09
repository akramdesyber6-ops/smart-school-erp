create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emis_code text,
  location text,
  phone text,
  email text,
  principal_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id),
  unique (emis_code)
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  school_id uuid not null references public.schools(id) on delete restrict,
  role text not null check (role in ('admin', 'school_admin', 'teacher', 'student', 'parent')),
  first_name text,
  last_name text,
  email text,
  phone text,
  national_id text,
  date_of_birth date,
  qualifications text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, school_id)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  year integer not null check (year between 2000 and 2200),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date),
  unique (school_id, year),
  unique (id, school_id)
);

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date),
  unique (school_id, academic_year_id, name),
  unique (id, school_id),
  foreign key (academic_year_id, school_id)
    references public.academic_years (id, school_id) on delete restrict
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  stream text,
  curriculum text not null default 'CBC' check (curriculum in ('CBC', 'NCDC')),
  form_level integer check (form_level between 1 and 6),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name, stream),
  unique (id, school_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  code text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, code),
  unique (id, school_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  registration_number text not null,
  date_of_birth date,
  gender text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, registration_number),
  unique (id, school_id)
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  relationship_to_student text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, school_id)
);

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (class_id, subject_id)
);

create table if not exists public.student_parents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  is_primary_contact boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, parent_id)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  class_id uuid not null,
  term_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'withdrawn', 'completed')),
  enrollment_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, term_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete restrict,
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict,
  foreign key (term_id, school_id) references public.academic_terms (id, school_id) on delete restrict
);

create table if not exists public.markbook_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  term_id uuid not null,
  raw_score numeric(5,2),
  bot_score numeric(5,2),
  mot_score numeric(5,2),
  eot_score numeric(5,2),
  total_percentage numeric(5,2),
  grade text,
  descriptor text,
  competency_code text,
  competency_score integer check (competency_score between 1 and 3),
  observation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (raw_score is null or raw_score between 0 and 100),
  check (total_percentage is null or total_percentage between 0 and 100),
  unique (student_id, class_id, subject_id, term_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete restrict,
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete restrict,
  foreign key (term_id, school_id) references public.academic_terms (id, school_id) on delete restrict
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  class_id uuid not null,
  term_id uuid not null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, date),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete restrict,
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete restrict,
  foreign key (term_id, school_id) references public.academic_terms (id, school_id) on delete restrict
);

create index if not exists profiles_school_role_idx on public.profiles (school_id, role) where is_active;
create index if not exists classes_school_name_idx on public.classes (school_id, name);
create index if not exists subjects_school_name_idx on public.subjects (school_id, name);
create index if not exists students_school_name_idx on public.students (school_id, last_name, first_name);
create index if not exists enrollments_school_class_term_idx on public.enrollments (school_id, class_id, term_id);
create index if not exists markbook_school_class_term_idx on public.markbook_entries (school_id, class_id, term_id);
create index if not exists attendance_school_class_date_idx on public.attendance (school_id, class_id, date);

create or replace function public.assert_class_subject_tenant_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.classes c
    join public.subjects s on s.id = new.subject_id and s.school_id = c.school_id
    where c.id = new.class_id
  ) then
    raise exception 'class and subject must belong to the same school';
  end if;

  if new.teacher_id is not null and not exists (
    select 1
    from public.classes c
    join public.profiles p on p.id = new.teacher_id and p.school_id = c.school_id
    where c.id = new.class_id
  ) then
    raise exception 'teacher must belong to the same school as the class';
  end if;

  return new;
end;
$$;

create or replace function public.assert_student_parent_tenant_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.students s
    join public.parents p on p.id = new.parent_id and p.school_id = s.school_id
    where s.id = new.student_id
  ) then
    raise exception 'student and parent must belong to the same school';
  end if;

  return new;
end;
$$;

drop trigger if exists class_subjects_tenant_match on public.class_subjects;
create trigger class_subjects_tenant_match
  before insert or update on public.class_subjects
  for each row execute function public.assert_class_subject_tenant_match();

drop trigger if exists student_parents_tenant_match on public.student_parents;
create trigger student_parents_tenant_match
  before insert or update on public.student_parents
  for each row execute function public.assert_student_parent_tenant_match();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'schools', 'profiles', 'academic_years', 'academic_terms', 'classes', 'subjects',
    'students', 'parents', 'class_subjects', 'student_parents', 'enrollments',
    'markbook_entries', 'attendance'
  ] loop
    execute format('drop trigger if exists %I on public.%I', format('set_%s_updated_at', table_name), table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      format('set_%s_updated_at', table_name),
      table_name
    );
  end loop;
end;
$$;
