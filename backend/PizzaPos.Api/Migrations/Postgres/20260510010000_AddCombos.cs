using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PizzaPos.Api.Data;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260510010000_AddCombos")]
    public partial class AddCombos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS combos (
                    ""Id""           uuid                       NOT NULL,
                    ""StoreId""      uuid                       NOT NULL,
                    ""Name""         character varying(200)     NOT NULL,
                    ""Description""  character varying(1000),
                    ""Price""        numeric(18,2)              NOT NULL,
                    ""IsActive""     boolean                    NOT NULL,
                    ""DisplayOrder"" integer                    NOT NULL,
                    ""CreatedAt""    timestamp with time zone   NOT NULL,
                    ""UpdatedAt""    timestamp with time zone,
                    CONSTRAINT ""PK_combos"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_combos_stores_StoreId""
                        FOREIGN KEY (""StoreId"") REFERENCES stores (""Id"") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS ""IX_combos_StoreId_IsActive""
                    ON combos (""StoreId"", ""IsActive"");
                CREATE INDEX IF NOT EXISTS ""IX_combos_StoreId_DisplayOrder""
                    ON combos (""StoreId"", ""DisplayOrder"");

                CREATE TABLE IF NOT EXISTS combo_items (
                    ""Id""           uuid                       NOT NULL,
                    ""StoreId""      uuid                       NOT NULL,
                    ""ComboId""      uuid                       NOT NULL,
                    ""Label""        character varying(100)     NOT NULL,
                    ""CategoryId""   uuid                       NOT NULL,
                    ""Quantity""     integer                    NOT NULL,
                    ""DisplayOrder"" integer                    NOT NULL,
                    ""CreatedAt""    timestamp with time zone   NOT NULL,
                    ""UpdatedAt""    timestamp with time zone,
                    CONSTRAINT ""PK_combo_items"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_combo_items_combos_ComboId""
                        FOREIGN KEY (""ComboId"") REFERENCES combos (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_combo_items_categories_CategoryId""
                        FOREIGN KEY (""CategoryId"") REFERENCES categories (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_combo_items_stores_StoreId""
                        FOREIGN KEY (""StoreId"") REFERENCES stores (""Id"") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS ""IX_combo_items_StoreId_ComboId""
                    ON combo_items (""StoreId"", ""ComboId"");
                CREATE INDEX IF NOT EXISTS ""IX_combo_items_ComboId""
                    ON combo_items (""ComboId"");
                CREATE INDEX IF NOT EXISTS ""IX_combo_items_CategoryId""
                    ON combo_items (""CategoryId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS combo_items;
                DROP TABLE IF EXISTS combos;
            ");
        }
    }
}
