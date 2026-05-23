using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PizzaPos.Api.Data;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260522180000_AddDeliveryAdditionalPriceToProductOption")]
    public partial class AddDeliveryAdditionalPriceToProductOption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Paket servis (Delivery) sipariş tipinde option/boyut için ayrı ek
            // fiyat. Null ise normal AdditionalPrice'a fallback yapılır
            // (OrderService.EffectiveOptionPrice). Product.DeliveryPrice ile
            // aynı semantik — gel-al/dine-in her zaman AdditionalPrice kullanır.
            migrationBuilder.Sql(@"
                ALTER TABLE product_options
                    ADD COLUMN IF NOT EXISTS ""DeliveryAdditionalPrice"" numeric(18,2) NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE product_options DROP COLUMN IF EXISTS ""DeliveryAdditionalPrice"";
            ");
        }
    }
}
