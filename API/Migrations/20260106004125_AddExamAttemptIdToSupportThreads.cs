using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class AddExamAttemptIdToSupportThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupportMessages_ThreadId",
                table: "SupportMessages");

            migrationBuilder.AddColumn<int>(
                name: "ExamAttemptId",
                table: "SupportThreads",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupportThreads_ExamAttemptId",
                table: "SupportThreads",
                column: "ExamAttemptId",
                unique: true,
                filter: "\"ExamAttemptId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_IsFromAdmin",
                table: "SupportMessages",
                column: "IsFromAdmin");

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_ThreadId_CreatedAt",
                table: "SupportMessages",
                columns: new[] { "ThreadId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_SupportThreads_ExamAttempts_ExamAttemptId",
                table: "SupportThreads",
                column: "ExamAttemptId",
                principalTable: "ExamAttempts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupportThreads_ExamAttempts_ExamAttemptId",
                table: "SupportThreads");

            migrationBuilder.DropIndex(
                name: "IX_SupportThreads_ExamAttemptId",
                table: "SupportThreads");

            migrationBuilder.DropIndex(
                name: "IX_SupportMessages_IsFromAdmin",
                table: "SupportMessages");

            migrationBuilder.DropIndex(
                name: "IX_SupportMessages_ThreadId_CreatedAt",
                table: "SupportMessages");

            migrationBuilder.DropColumn(
                name: "ExamAttemptId",
                table: "SupportThreads");

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_ThreadId",
                table: "SupportMessages",
                column: "ThreadId");
        }
    }
}
