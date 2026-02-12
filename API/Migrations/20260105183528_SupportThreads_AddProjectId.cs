using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class SupportThreads_AddProjectId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "SupportThreads",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupportThreads_ProjectId",
                table: "SupportThreads",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_SupportThreads_Projects_ProjectId",
                table: "SupportThreads",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupportThreads_Projects_ProjectId",
                table: "SupportThreads");

            migrationBuilder.DropIndex(
                name: "IX_SupportThreads_ProjectId",
                table: "SupportThreads");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "SupportThreads");
        }
    }
}
