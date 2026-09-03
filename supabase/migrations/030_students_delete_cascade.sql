-- Les 8 tables enfants de students (group_students, payment_reminders,
-- registration_fees, student_events, student_grades, student_group_subjects,
-- student_payments, student_subscriptions) portent toutes une clé étrangère
-- en ON DELETE NO ACTION sur la base en ligne, alors que la migration 001
-- déclarait bien « on delete cascade » pour registration_fees : la table
-- préexistait, le create table if not exists n'a donc rien appliqué.
--
-- Conséquence : supprimer un élève exige de vider d'abord ses 8 tables
-- enfants, une par une et dans le bon ordre, sinon Postgres refuse avec
--   « update or delete on table "students" violates foreign key constraint »
-- Aujourd'hui l'application n'expose aucun bouton de suppression d'élève,
-- donc rien n'est cassé — mais toute suppression manuelle en SQL, et tout
-- futur bouton, se heurtent à ce mur.
--
-- Cette migration repasse ces clés en ON DELETE CASCADE : supprimer l'élève
-- emporte ses inscriptions, paiements, notes et pointages. C'est le
-- comportement voulu, ces lignes n'ont aucun sens sans leur élève.
--
-- Idempotente : les clés déjà en cascade sont laissées telles quelles, on
-- peut relancer le fichier sans effet.
--
-- ⚠ Fermez les onglets de l'application avant d'exécuter. Chaque clé est
-- reconstruite sous verrou exclusif bref ; une requête de l'app au même
-- instant provoque un blocage mutuel. Une table verrouillée est signalée et
-- ignorée, sa clé d'origine intacte : relancez le fichier plus tard.
do $$
declare
  target record;
  cols text;
  refcols text;
  patched integer := 0;
  skipped text[] := '{}';
begin
  -- On abandonne vite plutôt que d'attendre un verrou occupé : une table
  -- bloquée ne doit pas faire échouer les sept autres.
  perform set_config('lock_timeout', '3s', true);

  for target in
    select con.conname,
           con.conrelid,
           con.confrelid,
           con.conkey,
           con.confkey,
           src.relname as child
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    join pg_namespace tns on tns.oid = tgt.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'public'
      and tns.nspname = 'public'
      and tgt.relname = 'students'
      and con.confdeltype <> 'c'   -- 'c' = déjà en cascade, rien à faire
    order by src.relname
  loop
    -- La définition est reconstruite depuis le catalogue plutôt que parsée
    -- depuis pg_get_constraintdef : les colonnes sont ainsi reprises telles
    -- quelles, quels que soient leur nom et leur nombre.
    select string_agg(quote_ident(att.attname), ', ' order by k.ord)
      into cols
      from unnest(target.conkey) with ordinality as k(attnum, ord)
      join pg_attribute att
        on att.attrelid = target.conrelid
       and att.attnum = k.attnum;

    select string_agg(quote_ident(att.attname), ', ' order by k.ord)
      into refcols
      from unnest(target.confkey) with ordinality as k(attnum, ord)
      join pg_attribute att
        on att.attrelid = target.confrelid
       and att.attnum = k.attnum;

    begin
      -- Drop puis add dans un même sous-bloc : si l'ajout échoue, le drop est
      -- annulé avec lui et la table conserve sa clé d'origine.
      execute format('alter table public.%I drop constraint %I', target.child, target.conname);
      execute format(
        'alter table public.%I add constraint %I foreign key (%s) references public.students (%s) on delete cascade',
        target.child, target.conname, cols, refcols
      );
      patched := patched + 1;
      raise notice 'OK — %.% repassée en ON DELETE CASCADE', target.child, target.conname;
    exception
      when others then
        skipped := skipped || target.child;
        raise notice 'IGNORÉE — % : %', target.child, sqlerrm;
    end;
  end loop;

  if patched = 0 and cardinality(skipped) = 0 then
    raise notice 'Rien à corriger : toutes les clés vers students sont déjà en cascade.';
  else
    raise notice '% clé(s) corrigée(s).', patched;
  end if;

  if cardinality(skipped) > 0 then
    raise notice '% table(s) ignorée(s) : %. Fermez l''application et relancez ce fichier.',
      cardinality(skipped), array_to_string(skipped, ', ');
  end if;
end $$;
