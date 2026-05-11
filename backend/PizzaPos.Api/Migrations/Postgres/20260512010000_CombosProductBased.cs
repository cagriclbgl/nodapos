using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PizzaPos.Api.Data;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260512010000_CombosProductBased")]
    public partial class CombosProductBased : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Slot-bazlı kombo modeli kullanışsız bulundu; yeni model sabit ürün
            // listesi (yönetici doğrudan menüden ürünler seçer). Eski combo_items
            // satırları silinir (kullanıcı kombo'ları yeniden yaratır); şema
            // CategoryId/Label kolonlarını ProductId'ye çevirir.
            migrationBuilder.Sql(@"
                DELETE FROM combo_items;

                ALTER TABLE combo_items DROP CONSTRAINT IF EXISTS ""FK_combo_items_categories_CategoryId"";
                DROP INDEX IF EXISTS ""IX_combo_items_CategoryId"";

                ALTER TABLE combo_items DROP COLUMN IF EXISTS ""Label"";
                ALTER TABLE combo_items DROP COLUMN IF EXISTS ""CategoryId"";

                ALTER TABLE combo_items ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NOT NULL;

                ALTER TABLE combo_items
                    ADD CONSTRAINT ""FK_combo_items_products_ProductId""
                    FOREIGN KEY (""ProductId"") REFERENCES products (""Id"") ON DELETE RESTRICT;

                CREATE INDEX IF NOT EXISTS ""IX_combo_items_StoreId_ProductId""
                    ON combo_items (""StoreId"", ""ProductId"");
                CREATE INDEX IF NOT EXISTS ""IX_combo_items_ProductId""
                    ON combo_items (""ProductId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM combo_items;

                DROP INDEX IF EXISTS ""IX_combo_items_StoreId_ProductId"";
                DROP INDEX IF EXISTS ""IX_combo_items_ProductId"";
                ALTER TABLE combo_items DROP CONSTRAINT IF EXISTS ""FK_combo_items_products_ProductId"";

                ALTER TABLE combo_items DROP COLUMN IF EXISTS ""ProductId"";

                ALTER TABLE combo_items ADD COLUMN IF NOT EXISTS ""Label"" character varying(100) NOT NULL DEFAULT '';
                ALTER TABLE combo_items ADD COLUMN IF NOT EXISTS ""CategoryId"" uuid NOT NULL;

                ALTER TABLE combo_items
                    ADD CONSTRAINT ""FK_combo_items_categories_CategoryId""
                    FOREIGN KEY (""CategoryId"") REFERENCES categories (""Id"") ON DELETE RESTRICT;

                CREATE INDEX IF NOT EXISTS ""IX_combo_items_CategoryId""
                    ON combo_items (""CategoryId"");
            ");
        }
    }
}
