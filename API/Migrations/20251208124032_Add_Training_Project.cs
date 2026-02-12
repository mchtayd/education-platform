using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class Add_Training_Project : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "Trainings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Trainings_ProjectId",
                table: "Trainings",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Trainings_Projects_ProjectId",
                table: "Trainings",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Trainings_Projects_ProjectId",
                table: "Trainings");

            migrationBuilder.DropIndex(
                name: "IX_Trainings_ProjectId",
                table: "Trainings");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "Trainings");
        }
    }
}
