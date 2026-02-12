using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class Sync_AppModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserRequests_Projects_ProjectId",
                table: "UserRequests");

            migrationBuilder.CreateIndex(
                name: "IX_UserRequests_Email",
                table: "UserRequests",
                column: "Email");

            migrationBuilder.AddForeignKey(
                name: "FK_UserRequests_Projects_ProjectId",
                table: "UserRequests",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserRequests_Projects_ProjectId",
                table: "UserRequests");

            migrationBuilder.DropIndex(
                name: "IX_UserRequests_Email",
                table: "UserRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_UserRequests_Projects_ProjectId",
                table: "UserRequests",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }
    }
}
