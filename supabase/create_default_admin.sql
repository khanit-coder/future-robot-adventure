-- Create Default Administrator Account
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'admin@college.ac.th') then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'admin@college.ac.th',
      extensions.crypt('admin123456', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    insert into public.admins (user_id, email, role)
    values (new_user_id, 'admin@college.ac.th', 'SUPER_ADMIN')
    on conflict (user_id) do nothing;
  end if;
end $$;
