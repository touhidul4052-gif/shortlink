/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('links', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    long_url: {
      type: 'text',
      notNull: true,
    },
    short_code: {
      type: 'varchar(64)',
      notNull: true,
    },
    custom_alias: {
      type: 'varchar(64)',
      notNull: false,
    },
    user_id: {
      type: 'uuid',
      notNull: false,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: false,
    },
    clicks: {
      type: 'bigint',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // short_code is empty string only briefly during the two-step insert
  // for generated codes; we still enforce uniqueness via a partial index
  // on non-empty values so the lookup remains fast and collision-safe.
  pgm.createIndex('links', 'short_code', {
    name: 'links_short_code_unique',
    unique: true,
    where: "short_code <> ''",
  });
  pgm.createIndex('links', 'user_id', { name: 'links_user_id_idx' });
  pgm.createIndex('links', 'expires_at', {
    name: 'links_expires_at_idx',
    where: 'expires_at IS NOT NULL',
  });

  pgm.createTable('link_analytics', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    link_id: {
      type: 'bigint',
      notNull: true,
      references: '"links"(id)',
      onDelete: 'CASCADE',
    },
    ip_address: {
      type: 'inet',
      notNull: false,
    },
    user_agent: {
      type: 'text',
      notNull: false,
    },
    referrer: {
      type: 'text',
      notNull: false,
    },
    device_type: {
      type: 'varchar(16)',
      notNull: false,
    },
    country: {
      type: 'varchar(2)',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('link_analytics', 'link_id', {
    name: 'link_analytics_link_id_idx',
  });
  pgm.createIndex('link_analytics', 'created_at', {
    name: 'link_analytics_created_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('link_analytics');
  pgm.dropTable('links');
};
