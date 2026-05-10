using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddCustomersAndOutbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Recreate the customers + customer_addresses tables that the
            // original AddCustomers migration .cs file was supposed to create.
            // (The .cs was lost in Sprint 6 — the model snapshot kept these
            // entities but no migration actually emitted CREATE TABLE for them.
            // Old Supabase already had the tables, so it never noticed; a fresh
            // Hetzner Postgres would be missing them entirely.)
            //
            // Wrapped in raw SQL with IF NOT EXISTS so that any existing
            // database where the AddCustomers migration was historically
            // applied — and the tables are therefore already present — keeps
            // working. New / clean databases get the tables for the first time.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS customers (
                    ""Id""        uuid                       NOT NULL,
                    ""StoreId""   uuid                       NOT NULL,
                    ""Name""      character varying(200)     NOT NULL,
                    ""Phone""     character varying(50)      NOT NULL,
                    ""Notes""     character varying(1000),
                    ""IsActive""  boolean                    NOT NULL,
                    ""CreatedAt"" timestamp with time zone   NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    CONSTRAINT ""PK_customers"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_customers_stores_StoreId""
                        FOREIGN KEY (""StoreId"") REFERENCES stores (""Id"") ON DELETE RESTRICT
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_customers_StoreId_Phone""
                    ON customers (""StoreId"", ""Phone"");
                CREATE INDEX IF NOT EXISTS ""IX_customers_StoreId_IsActive""
                    ON customers (""StoreId"", ""IsActive"");
                CREATE INDEX IF NOT EXISTS ""IX_customers_StoreId_Name""
                    ON customers (""StoreId"", ""Name"");

                CREATE TABLE IF NOT EXISTS customer_addresses (
                    ""Id""          uuid                     NOT NULL,
                    ""StoreId""     uuid                     NOT NULL,
                    ""CustomerId""  uuid                     NOT NULL,
                    ""Label""       character varying(50)    NOT NULL,
                    ""AddressLine"" character varying(500)   NOT NULL,
                    ""District""    character varying(100),
                    ""Notes""       character varying(500),
                    ""IsDefault""   boolean                  NOT NULL,
                    ""CreatedAt""   timestamp with time zone NOT NULL,
                    ""UpdatedAt""   timestamp with time zone,
                    CONSTRAINT ""PK_customer_addresses"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_customer_addresses_customers_CustomerId""
                        FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_customer_addresses_stores_StoreId""
                        FOREIGN KEY (""StoreId"") REFERENCES stores (""Id"") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS ""IX_customer_addresses_StoreId_CustomerId""
                    ON customer_addresses (""StoreId"", ""CustomerId"");
                CREATE INDEX IF NOT EXISTS ""IX_customer_addresses_CustomerId""
                    ON customer_addresses (""CustomerId"");

                -- Order-side links to a customer + delivery address. The original
                -- AddCustomers migration emitted these columns; the recreated .cs
                -- after the Sprint 6 EF tool mishap forgot them. Idempotent so
                -- both legacy databases (Supabase) and fresh ones (Hetzner) end
                -- up with the same schema.
                ALTER TABLE orders
                    ADD COLUMN IF NOT EXISTS ""CustomerId""        uuid NULL,
                    ADD COLUMN IF NOT EXISTS ""CustomerAddressId"" uuid NULL;

                CREATE INDEX IF NOT EXISTS ""IX_orders_StoreId_CustomerId""
                    ON orders (""StoreId"", ""CustomerId"");
            ");

            migrationBuilder.CreateTable(
                name: "outbox_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AggregateType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AggregateId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LastAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbox_events", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outbox_events_SentAt_CreatedAt",
                table: "outbox_events",
                columns: new[] { "SentAt", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outbox_events");
            migrationBuilder.Sql("DROP TABLE IF EXISTS customer_addresses;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS customers;");
        }
    }
}
