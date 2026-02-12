using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class TrainingAssignment_UnpublishAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UnpublishAt",
                table: "TrainingAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingAssignments_UnpublishAt",
                table: "TrainingAssignments",
                column: "UnpublishAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrainingAssignments_UnpublishAt",
                table: "TrainingAssignments");

            migrationBuilder.DropColumn(
                name: "UnpublishAt",
                table: "TrainingAssignments");
        }
    }
}
