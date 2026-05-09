using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PizzaPos.Api.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddOutboxApplyTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedAt",
                table: "outbox_events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApplyError",
                table: "outbox_events",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outbox_events_AppliedAt_CreatedAt",
                table: "outbox_events",
                columns: new[] { "AppliedAt", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_outbox_events_AppliedAt_CreatedAt",
                table: "outbox_events");

            migrationBuilder.DropColumn(
                name: "AppliedAt",
                table: "outbox_events");

            migrationBuilder.DropColumn(
                name: "ApplyError",
                table: "outbox_events");
        }
    }
}
