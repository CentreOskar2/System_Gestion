-- L'application insère ses lignes sans jamais renseigner created_at : elle
-- compte sur la valeur par défaut de la colonne. Là où le schéma d'origine l'a
-- omise, l'insertion échoue avec :
--   « null value in column "created_at" ... violates not-null constraint »
--
-- C'est ce qui bloquait la validation d'un salaire (teacher_salaries).
-- Les migrations 013, 019, 022, 023 et 024 ont déjà rattrapé ce défaut table
-- par table, au fil des plantages. Celle-ci le règle pour toutes les tables du
-- schéma public, plutôt que d'attendre le prochain.
--
-- Sans risque : poser un défaut ne réécrit pas la table et ne touche aucune
-- ligne existante ; now() est la seule valeur sensée pour un created_at.
--
-- ⚠ Fermez les onglets de l'application avant d'exécuter. ALTER TABLE réclame
-- un verrou exclusif bref, et une requête de l'app au même instant provoque un
-- blocage mutuel. Si une table reste malgré tout inaccessible, elle est
-- simplement signalée et ignorée : relancez ce fichier plus tard, il ne
-- retouche que ce qui n'a pas encore de défaut.
do $$
declare
  target record;
  patched integer := 0;
  skipped text[] := '{}';
begin
  -- Plutôt que d'attendre indéfiniment un verrou occupé, on abandonne vite :
  -- une table bloquée ne doit pas faire échouer toutes les autres.
  perform set_config('lock_timeout', '3s', true);

  for target in
    select columns.table_name
    from information_schema.columns
    join information_schema.tables
      on tables.table_schema = columns.table_schema
     and tables.table_name = columns.table_name
    where columns.table_schema = 'public'
      and columns.column_name = 'created_at'
      and columns.data_type in ('timestamp with time zone', 'timestamp without time zone')
      and columns.column_default is null
      and tables.table_type = 'BASE TABLE'
    -- teacher_salaries d'abord : c'est elle qui bloque la validation des
    -- salaires, elle doit passer même si une autre table est verrouillée.
    order by (columns.table_name <> 'teacher_salaries'), columns.table_name
  loop
    begin
      execute format('alter table public.%I alter column created_at set default now()', target.table_name);
      patched := patched + 1;
      raise notice 'OK — défaut now() posé sur %', target.table_name;
    exception
      when others then
        -- Le sous-bloc seul est annulé : la boucle continue sur les suivantes.
        skipped := skipped || target.table_name;
        raise notice 'IGNORÉE — % : %', target.table_name, sqlerrm;
    end;
  end loop;

  if patched = 0 and cardinality(skipped) = 0 then
    raise notice 'Rien à corriger : toutes les colonnes created_at ont déjà un défaut.';
  else
    raise notice '% table(s) corrigée(s).', patched;
  end if;

  if cardinality(skipped) > 0 then
    raise notice '% table(s) ignorée(s) : %. Fermez l''application et relancez ce fichier.',
      cardinality(skipped), array_to_string(skipped, ', ');
  end if;
end $$;
