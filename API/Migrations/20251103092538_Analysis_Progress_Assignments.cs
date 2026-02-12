using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class Analysis_Progress_Assignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrainingAssignments_Projects_ProjectId",
                table: "TrainingAssignments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TrainingAssignments_Target",
                table: "TrainingAssignments");

            migrationBuilder.AddColumn<int>(
                name: "TrainingId1",
                table: "TrainingAssignments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TrainingProgresses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TrainingId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Progress = table.Column<int>(type: "integer", nullable: false),
                    LastViewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Rating = table.Column<int>(type: "integer", nullable: true),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingProgresses_Trainings_TrainingId",
                        column: x => x.TrainingId,
                        principalTable: "Trainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrainingProgresses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingAssignments_TrainingId1",
                table: "TrainingAssignments",
                column: "TrainingId1");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TrainingAssignments_Target",
                table: "TrainingAssignments",
                sql: "(\"UserId\" IS NOT NULL AND \"ProjectId\" IS NULL) OR (\"UserId\" IS NULL AND \"ProjectId\" IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingProgresses_TrainingId",
                table: "TrainingProgresses",
                column: "TrainingId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingProgresses_UserId_TrainingId",
                table: "TrainingProgresses",
                columns: new[] { "UserId", "TrainingId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingAssignments_Projects_ProjectId",
                table: "TrainingAssignments",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingAssignments_Trainings_TrainingId1",
                table: "TrainingAssignments",
                column: "TrainingId1",
                principalTable: "Trainings",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrainingAssignments_Projects_ProjectId",
                table: "TrainingAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingAssignments_Trainings_TrainingId1",
                table: "TrainingAssignments");

            migrationBuilder.DropTable(
                name: "TrainingProgresses");

            migrationBuilder.DropIndex(
                name: "IX_TrainingAssignments_TrainingId1",
                table: "TrainingAssignments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TrainingAssignments_Target",
                table: "TrainingAssignments");

            migrationBuilder.DropColumn(
                name: "TrainingId1",
                table: "TrainingAssignments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TrainingAssignments_Target",
                table: "TrainingAssignments",
                sql: "(\"UserId\" IS NOT NULL) <> (\"ProjectId\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingAssignments_Projects_ProjectId",
                table: "TrainingAssignments",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }
    }
}
