using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddUsersAndAuditUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StoreId = table.Column<Guid>(type: "uuid", nullable: false),
                    StoreId1 = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_users_stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_users_stores_StoreId1",
                        column: x => x.StoreId1,
                        principalTable: "stores",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_StoreId_IsActive",
                table: "users",
                columns: new[] { "StoreId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_users_StoreId_Username",
                table: "users",
                columns: new[] { "StoreId", "Username" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_StoreId1",
                table: "users",
                column: "StoreId1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "orders");
        }
    }
}
