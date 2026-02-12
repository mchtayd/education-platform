using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class ExamRetakeAndTrainingGate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExamAttempts_ExamId_UserId",
                table: "ExamAttempts");

            migrationBuilder.CreateIndex(
                name: "IX_ExamAttempts_ExamId_UserId",
                table: "ExamAttempts",
                columns: new[] { "ExamId", "UserId" },
                unique: true,
                filter: "\"SubmittedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExamAttempts_ExamId_UserId",
                table: "ExamAttempts");

            migrationBuilder.CreateIndex(
                name: "IX_ExamAttempts_ExamId_UserId",
                table: "ExamAttempts",
                columns: new[] { "ExamId", "UserId" },
                unique: true);
        }
    }
}
