using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PizzaPos.Api.Data;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260510120000_AddIncomingCallsAndDeliveryFields")]
    public partial class AddIncomingCallsAndDeliveryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS incoming_calls (
                    ""Id""                 uuid                       NOT NULL,
                    ""StoreId""            uuid                       NOT NULL,
                    ""Phone""              character varying(50),
                    ""LineNumber""         integer,
                    ""ReceivedAt""         timestamp with time zone   NOT NULL,
                    ""MatchedCustomerId""  uuid,
                    ""ResolvedOrderId""    uuid,
                    ""Status""             integer                    NOT NULL,
                    ""HandledByUserId""    uuid,
                    ""HandledAt""          timestamp with time zone,
                    ""Note""               character varying(500),
                    ""RawPayloadHex""      character varying(2000),
                    ""CreatedAt""          timestamp with time zone   NOT NULL,
                    ""UpdatedAt""          timestamp with time zone,
                    CONSTRAINT ""PK_incoming_calls"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_incoming_calls_stores_StoreId""
                        FOREIGN KEY (""StoreId"") REFERENCES stores (""Id"") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS ""IX_incoming_calls_StoreId_ReceivedAt""
                    ON incoming_calls (""StoreId"", ""ReceivedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_incoming_calls_StoreId_Status_ReceivedAt""
                    ON incoming_calls (""StoreId"", ""Status"", ""ReceivedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_incoming_calls_StoreId_MatchedCustomerId""
                    ON incoming_calls (""StoreId"", ""MatchedCustomerId"");

                -- Order tablosuna delivery flow (Sprint B) alanları. Idempotent —
                -- daha önce kısmen eklenmiş olabilir, IF NOT EXISTS koruması.
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""DeliveryAddressSnapshot"" character varying(500);
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""DeliveryDistrict""        character varying(100);
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""FulfillmentStatus""       integer NOT NULL DEFAULT 0;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""AssignedCourierUserId""   uuid;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""OutForDeliveryAt""        timestamp with time zone;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""DeliveredAt""             timestamp with time zone;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS ""IncomingCallId""          uuid;

                CREATE INDEX IF NOT EXISTS ""IX_orders_StoreId_OrderType_FulfillmentStatus""
                    ON orders (""StoreId"", ""OrderType"", ""FulfillmentStatus"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ""IX_orders_StoreId_OrderType_FulfillmentStatus"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""IncomingCallId"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""DeliveredAt"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""OutForDeliveryAt"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""AssignedCourierUserId"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""FulfillmentStatus"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""DeliveryDistrict"";
                ALTER TABLE orders DROP COLUMN IF EXISTS ""DeliveryAddressSnapshot"";

                DROP TABLE IF EXISTS incoming_calls;
            ");
        }
    }
}
