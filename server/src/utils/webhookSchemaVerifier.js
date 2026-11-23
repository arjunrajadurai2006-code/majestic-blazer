/**
 * Exhaustive Programmatic Schema Verifier for webhook_events
 * Verifies exact column set, data types, nullability, defaults,
 * composite primary key, exact CHECK constraint expressions, and exact index definitions.
 */

export const EXPECTED_SCHEMA_SPEC = {
  columns: {
    account_id: { type: 'character varying', max_len: 100, nullable: false, default: null },
    environment: { type: 'character varying', max_len: 50, nullable: false, default: null },
    event_id: { type: 'character varying', max_len: 255, nullable: false, default: null },
    event_type: { type: 'character varying', max_len: 100, nullable: false, default: null },
    status: { type: 'character varying', max_len: 30, nullable: false, default: "'processing'::character varying" },
    claim_token: { udt: 'uuid', nullable: true, default: null },
    entity_id: { type: 'character varying', max_len: 100, nullable: true, default: null },
    order_id: { type: 'character varying', max_len: 100, nullable: true, default: null },
    amount_minor: { type: 'bigint', nullable: true, default: null },
    currency: { type: 'character varying', max_len: 3, nullable: false, default: "'INR'::character varying" },
    attempts: { type: 'integer', nullable: false, default: '1' },
    locked_until: { type: 'timestamp with time zone', nullable: true, default: null },
    error_message: { type: 'text', nullable: true, default: null },
    created_at: { type: 'timestamp with time zone', nullable: false, default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'timestamp with time zone', nullable: false, default: 'CURRENT_TIMESTAMP' },
    completed_at: { type: 'timestamp with time zone', nullable: true, default: null },
  },
  primaryKey: {
    name: 'pk_webhook_events',
    columns: ['account_id', 'environment', 'event_id'],
  },
  checks: {
    chk_webhook_events_status: "CHECK (((status)::text = ANY ((ARRAY['processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))",
    chk_webhook_events_attempts: "CHECK ((attempts >= 1))",
    chk_webhook_events_currency: "CHECK (((currency)::text = 'INR'::text))",
    chk_webhook_events_processing_fields: "CHECK ((((status)::text <> 'processing'::text) OR ((claim_token IS NOT NULL) AND (locked_until IS NOT NULL))))",
    chk_webhook_events_completed_fields: "CHECK ((((status)::text <> 'completed'::text) OR (completed_at IS NOT NULL)))",
  },
  indexes: {
    idx_webhook_events_status: "CREATE INDEX idx_webhook_events_status ON %SCHEMA%.webhook_events USING btree (status)",
    idx_webhook_events_lease: "CREATE INDEX idx_webhook_events_lease ON %SCHEMA%.webhook_events USING btree (locked_until) WHERE ((status)::text = 'processing'::text)",
    idx_webhook_events_entity: "CREATE INDEX idx_webhook_events_entity ON %SCHEMA%.webhook_events USING btree (account_id, environment, entity_id)",
    idx_webhook_events_order: "CREATE INDEX idx_webhook_events_order ON %SCHEMA%.webhook_events USING btree (account_id, environment, order_id)",
  },
};

/**
 * Normalizes PostgreSQL expressions for robust string comparison
 */
function normalizeExpression(expr) {
  if (!expr) return '';
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * Validates the webhook_events table in a target schema against the complete specification.
 * Throws detailed error upon any mismatch.
 */
export async function verifyWebhookEventsSchema(client, schemaName = 'public') {
  // 1. Table existence
  const { rows: tblRows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'webhook_events'`,
    [schemaName]
  );
  if (tblRows.length === 0) {
    return { exists: false, valid: false, reason: 'TABLE_DOES_NOT_EXIST' };
  }

  // 2. Column set, data types, nullability, and defaults
  const { rows: colRows } = await client.query(
    `SELECT column_name, data_type, udt_name, character_maximum_length, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'webhook_events'`,
    [schemaName]
  );

  const foundCols = Object.fromEntries(colRows.map((c) => [c.column_name, c]));
  const expectedColNames = Object.keys(EXPECTED_SCHEMA_SPEC.columns);
  const foundColNames = Object.keys(foundCols);

  // Assert exact column set (reject missing or extra columns)
  for (const expName of expectedColNames) {
    if (!foundCols[expName]) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Missing required column '${expName}' in ${schemaName}.webhook_events`);
    }
  }
  for (const foundName of foundColNames) {
    if (!EXPECTED_SCHEMA_SPEC.columns[foundName]) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Unexpected extra column '${foundName}' in ${schemaName}.webhook_events`);
    }
  }

  // Assert exact column properties
  for (const [colName, exp] of Object.entries(EXPECTED_SCHEMA_SPEC.columns)) {
    const act = foundCols[colName];
    if (exp.type && act.data_type !== exp.type) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Column '${colName}' type mismatch. Expected ${exp.type}, got ${act.data_type}`);
    }
    if (exp.udt && act.udt_name !== exp.udt) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Column '${colName}' udt mismatch. Expected ${exp.udt}, got ${act.udt_name}`);
    }
    if (exp.max_len !== undefined && act.character_maximum_length !== exp.max_len) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Column '${colName}' max length mismatch. Expected ${exp.max_len}, got ${act.character_maximum_length}`);
    }
    const isNullable = act.is_nullable === 'YES';
    if (isNullable !== exp.nullable) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Column '${colName}' nullability mismatch. Expected nullable=${exp.nullable}, got ${isNullable}`);
    }
    if (exp.default !== null) {
      const actDef = normalizeExpression(act.column_default);
      const expDef = normalizeExpression(exp.default);
      if (actDef !== expDef && !actDef.includes(expDef.replace(/::.*$/, ''))) {
        throw new Error(`SCHEMA_VERIFICATION_FAILED: Column '${colName}' default mismatch. Expected '${exp.default}', got '${act.column_default}'`);
      }
    }
  }

  // 3. Composite Primary Key Definition
  const { rows: pkRows } = await client.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = $1 AND tc.table_name = 'webhook_events' AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position;
  `, [schemaName]);

  if (pkRows.length === 0) {
    throw new Error(`SCHEMA_VERIFICATION_FAILED: Primary key is missing on ${schemaName}.webhook_events`);
  }
  const pkName = pkRows[0].constraint_name;
  if (pkName !== EXPECTED_SCHEMA_SPEC.primaryKey.name) {
    throw new Error(`SCHEMA_VERIFICATION_FAILED: Primary key constraint name mismatch. Expected '${EXPECTED_SCHEMA_SPEC.primaryKey.name}', got '${pkName}'`);
  }
  const pkCols = pkRows.map((r) => r.column_name);
  if (JSON.stringify(pkCols) !== JSON.stringify(EXPECTED_SCHEMA_SPEC.primaryKey.columns)) {
    throw new Error(`SCHEMA_VERIFICATION_FAILED: Primary key columns mismatch. Expected [${EXPECTED_SCHEMA_SPEC.primaryKey.columns.join(',')}], got [${pkCols.join(',')}]`);
  }

  // 4. CHECK Constraints & Exact Expressions
  const { rows: checkRows } = await client.query(`
    SELECT conname, pg_get_constraintdef(pg_constraint.oid) AS condef
    FROM pg_constraint 
    JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
    JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
    WHERE pg_namespace.nspname = $1 AND pg_class.relname = 'webhook_events' AND contype = 'c';
  `, [schemaName]);

  const foundChecks = Object.fromEntries(checkRows.map((r) => [r.conname, normalizeExpression(r.condef)]));
  for (const [chkName, expDef] of Object.entries(EXPECTED_SCHEMA_SPEC.checks)) {
    if (!foundChecks[chkName]) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Missing required check constraint '${chkName}'`);
    }
    const actDef = foundChecks[chkName];
    const normExp = normalizeExpression(expDef);
    if (actDef !== normExp) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Check constraint '${chkName}' expression mismatch.\nExpected: ${normExp}\nActual:   ${actDef}`);
    }
  }

  // 5. Required Indexes & Exact Index Definitions
  const { rows: idxRows } = await client.query(`
    SELECT indexname, pg_get_indexdef(pg_index.indexrelid) AS indexdef
    FROM pg_indexes
    JOIN pg_class ON pg_indexes.indexname = pg_class.relname
    JOIN pg_index ON pg_class.oid = pg_index.indexrelid
    WHERE schemaname = $1 AND tablename = 'webhook_events' AND indexname NOT LIKE '%_pkey' AND indexname != 'pk_webhook_events';
  `, [schemaName]);

  const foundIndexes = Object.fromEntries(idxRows.map((r) => [r.indexname, normalizeExpression(r.indexdef)]));
  for (const [idxName, templateDef] of Object.entries(EXPECTED_SCHEMA_SPEC.indexes)) {
    if (!foundIndexes[idxName]) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Missing required index '${idxName}' on ${schemaName}.webhook_events`);
    }
    const expDef = normalizeExpression(templateDef.replace(/%SCHEMA%/g, schemaName));
    const actDef = foundIndexes[idxName];
    if (actDef !== expDef) {
      throw new Error(`SCHEMA_VERIFICATION_FAILED: Index '${idxName}' definition mismatch.\nExpected: ${expDef}\nActual:   ${actDef}`);
    }
  }

  return { exists: true, valid: true };
}
