using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PizzaPos.Api.Data;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260512100000_AddDeliveryPrice")]
    public partial class AddDeliveryPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Paket servis (Delivery) sipariş tipinde uygulanan ayrı fiyat. Null
            // ise normal Price'a fallback yapılır (OrderService.EffectivePrice).
            migrationBuilder.Sql(@"
                ALTER TABLE products ADD COLUMN IF NOT EXISTS ""DeliveryPrice"" numeric(18,2) NULL;
                ALTER TABLE combos   ADD COLUMN IF NOT EXISTS ""DeliveryPrice"" numeric(18,2) NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE products DROP COLUMN IF EXISTS ""DeliveryPrice"";
                ALTER TABLE combos   DROP COLUMN IF EXISTS ""DeliveryPrice"";
            ");
        }
    }
}
