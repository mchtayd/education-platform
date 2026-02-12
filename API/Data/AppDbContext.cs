// API/Data/AppDbContext.cs
using Microsoft.EntityFrameworkCore;
using API.Models;

namespace API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // ---------- DbSets ----------
        public DbSet<User> Users => Set<User>();
        public DbSet<Project> Projects => Set<Project>();
        public DbSet<TrainingCategory> TrainingCategories => Set<TrainingCategory>();
        public DbSet<Training> Trainings => Set<Training>();
        public DbSet<TrainingAssignment> TrainingAssignments => Set<TrainingAssignment>();
        public DbSet<TrainingProgress> TrainingProgresses => Set<TrainingProgress>();
        public DbSet<ExamAttemptAnswer> ExamAttemptAnswers => Set<ExamAttemptAnswer>();
        public DbSet<SupportThread> SupportThreads => Set<SupportThread>();
        public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();
        public DbSet<UserProject> UserProjects => Set<UserProject>();
        public DbSet<Institution> Institutions => Set<Institution>();
        public DbSet<EmailVerification> EmailVerifications => Set<EmailVerification>();


        // Exams
        public DbSet<Exam> Exams => Set<Exam>();
        public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
        public DbSet<ExamChoice> ExamChoices => Set<ExamChoice>();
        public DbSet<ExamAssignment> ExamAssignments => Set<ExamAssignment>();
        public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
        public DbSet<ExamAnswer> ExamAnswers => Set<ExamAnswer>();

        // Talepler
        public DbSet<UserRequest> UserRequests => Set<UserRequest>();
        public DbSet<AccountRequest> AccountRequests => Set<AccountRequest>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            // ---------- User ----------
            var u = b.Entity<User>();
            u.ToTable("Users");
            u.HasIndex(x => x.Email).IsUnique();
            u.Property(x => x.Name).HasMaxLength(100);
            u.Property(x => x.Surname).HasMaxLength(100);
            u.Property(x => x.Email).HasMaxLength(200);
            u.Property(x => x.Phone).HasMaxLength(30);
            u.Property(x => x.Institution).HasMaxLength(200);
            u.Property(x => x.BusinessAddress).HasMaxLength(300);
            u.Property(x => x.PasswordHash).HasMaxLength(200);
            u.Property(x => x.Role).HasMaxLength(32).HasDefaultValue("user");
            u.Property(x => x.IsActive).HasDefaultValue(true);
            u.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");

            u.HasOne(x => x.Project)
             .WithMany(p => p.Users)
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.SetNull);

            // ---------- Project ----------
            var p = b.Entity<Project>();
            p.ToTable("Projects");
            p.Property(x => x.Name).HasMaxLength(200);
            p.HasIndex(x => x.Name).IsUnique();

            // ---------- TrainingCategory ----------
            var c = b.Entity<TrainingCategory>();
            c.ToTable("TrainingCategories");
            c.Property(x => x.Name).HasMaxLength(200);
            c.HasIndex(x => x.Name).IsUnique();

            // ---------- EmailVerifications ----------
            var ev = b.Entity<EmailVerification>();
ev.ToTable("EmailVerifications");
ev.Property(x => x.Email).HasMaxLength(200);
ev.Property(x => x.Salt).HasMaxLength(64);
ev.Property(x => x.CodeHash).HasMaxLength(200);
ev.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
ev.Property(x => x.ExpiresAt).HasColumnType("timestamp with time zone");
ev.Property(x => x.VerifiedAt).HasColumnType("timestamp with time zone");
ev.HasIndex(x => x.Email);


            // ---------- Training ----------
            var t = b.Entity<Training>();
            t.ToTable("Trainings");
            t.Property(x => x.Title).HasMaxLength(300);
            t.Property(x => x.ContentType).HasMaxLength(20);
            t.Property(x => x.FileUrl).HasMaxLength(600);
            t.Property(x => x.PublisherEmail).HasMaxLength(200);
            t.Property(x => x.Date).HasColumnType("timestamp with time zone");
            t.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");

            t.HasOne(x => x.Category)
             .WithMany(y => y.Trainings)
             .HasForeignKey(x => x.CategoryId)
             .OnDelete(DeleteBehavior.Restrict);

            // Eğitim -> Proje (opsiyonel)
            t.HasOne(x => x.Project)
             .WithMany()
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.SetNull);

            // ---------- UserRequest ----------
            var ur = b.Entity<UserRequest>();
            ur.ToTable("UserRequests");
            ur.Property(x => x.Email).HasMaxLength(200);
            ur.Property(x => x.Name).HasMaxLength(100);
            ur.Property(x => x.Surname).HasMaxLength(100);
            ur.Property(x => x.Phone).HasMaxLength(30);
            ur.Property(x => x.Institution).HasMaxLength(200);
            ur.Property(x => x.BusinessAddress).HasMaxLength(300);
            ur.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            ur.HasIndex(x => x.Email);
            ur.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);

            // ---------- AccountRequest ----------
            var ar = b.Entity<AccountRequest>();
            ar.ToTable("AccountRequests");
            ar.Property(x => x.Email).HasMaxLength(200);
            ar.Property(x => x.Name).HasMaxLength(100);
            ar.Property(x => x.Surname).HasMaxLength(100);
            ar.Property(x => x.Phone).HasMaxLength(30);
            ar.Property(x => x.Institution).HasMaxLength(200);
            ar.Property(x => x.BusinessAddress).HasMaxLength(300);
            ar.Property(x => x.PasswordHash).HasMaxLength(200);
            ar.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            ar.HasIndex(x => x.Email);
            ar.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);

            // ---------- Exams ----------
            var ex = b.Entity<Exam>();
            ex.ToTable("Exams");
            ex.Property(x => x.Title).HasMaxLength(300);
            ex.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            ex.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);

            var q = b.Entity<ExamQuestion>();
            q.ToTable("ExamQuestions");
            q.Property(x => x.Text).HasMaxLength(1000);
            q.HasOne(x => x.Exam).WithMany(e => e.Questions).HasForeignKey(x => x.ExamId).OnDelete(DeleteBehavior.Cascade);

            var ch = b.Entity<ExamChoice>();
            ch.ToTable("ExamChoices");
            ch.Property(x => x.Text).HasMaxLength(400);
            ch.Property(x => x.ImageUrl).HasMaxLength(600);
            ch.HasOne(x => x.Question).WithMany(qq => qq.Choices).HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);

            var ea = b.Entity<ExamAssignment>();
            ea.ToTable("ExamAssignments", tb =>
            {
                tb.HasCheckConstraint(
                    "CK_ExamAssignments_Target",
                    "(\"UserId\" IS NOT NULL AND \"ProjectId\" IS NULL) OR (\"UserId\" IS NULL AND \"ProjectId\" IS NOT NULL)"
                );
            });
            ea.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            ea.HasOne(x => x.Exam).WithMany().HasForeignKey(x => x.ExamId).OnDelete(DeleteBehavior.Cascade);
            ea.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            ea.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            ea.HasIndex(x => new { x.ExamId, x.UserId }).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
            ea.HasIndex(x => new { x.ExamId, x.ProjectId }).IsUnique().HasFilter("\"ProjectId\" IS NOT NULL");

            var at = b.Entity<ExamAttempt>();
            at.ToTable("ExamAttempts");
            at.Property(x => x.StartedAt).HasColumnType("timestamp with time zone");
            at.Property(x => x.SubmittedAt).HasColumnType("timestamp with time zone");

            // ✅ Retake serbest: UNIQUE kaldırıldı
            // ✅ Sadece "açık attempt" (SubmittedAt null) tek olsun
            at.HasIndex(x => new { x.ExamId, x.UserId })
              .IsUnique()
              .HasFilter("\"SubmittedAt\" IS NULL");

            at.HasOne(x => x.Exam).WithMany().HasForeignKey(x => x.ExamId).OnDelete(DeleteBehavior.Cascade);
            at.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);

            var ans = b.Entity<ExamAnswer>();
            ans.ToTable("ExamAnswers");
            ans.HasOne(x => x.Attempt).WithMany(a => a.Answers).HasForeignKey(x => x.AttemptId).OnDelete(DeleteBehavior.Cascade);

            // ---------- TrainingAssignment ----------
            var ta = b.Entity<TrainingAssignment>();
            ta.ToTable("TrainingAssignments", tb =>
            {
                tb.HasCheckConstraint(
                    "CK_TrainingAssignments_Target",
                    "(\"UserId\" IS NOT NULL AND \"ProjectId\" IS NULL) OR (\"UserId\" IS NULL AND \"ProjectId\" IS NOT NULL)"
                );
            });
            ta.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");

            ta.Property(x => x.UnpublishAt).HasColumnType("timestamp with time zone");
            ta.HasIndex(x => x.UnpublishAt);

            // İLİŞKİYİ SADECE BURADA TANIMLA (gölge FK oluşmasın)
            ta.HasOne(x => x.Training)
              .WithMany()
              .HasForeignKey(x => x.TrainingId)
              .OnDelete(DeleteBehavior.Cascade);

            ta.HasOne(x => x.User)
              .WithMany()
              .HasForeignKey(x => x.UserId)
              .OnDelete(DeleteBehavior.Cascade);

            ta.HasOne(x => x.Project)
              .WithMany()
              .HasForeignKey(x => x.ProjectId)
              .OnDelete(DeleteBehavior.Cascade);

            ta.HasIndex(x => new { x.TrainingId, x.UserId })
              .IsUnique()
              .HasFilter("\"UserId\" IS NOT NULL");

            ta.HasIndex(x => new { x.TrainingId, x.ProjectId })
              .IsUnique()
              .HasFilter("\"ProjectId\" IS NOT NULL");

            // ---------- TrainingProgress ----------
            var tp = b.Entity<TrainingProgress>();
            tp.ToTable("TrainingProgresses");
            tp.HasIndex(x => new { x.UserId, x.TrainingId }).IsUnique();
            tp.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            tp.Property(x => x.UpdatedAt).HasColumnType("timestamp with time zone");
            tp.Property(x => x.LastViewedAt).HasColumnType("timestamp with time zone");
            tp.Property(x => x.CompletedAt).HasColumnType("timestamp with time zone");
            tp.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            tp.HasOne(x => x.Training).WithMany().HasForeignKey(x => x.TrainingId).OnDelete(DeleteBehavior.Cascade);

            b.Entity<ExamAttemptAnswer>()
             .HasIndex(x => new { x.AttemptId, x.QuestionId })
             .IsUnique();

             // ---------- Institutions ----------
var ins = b.Entity<Institution>();
ins.ToTable("Institutions");
ins.Property(x => x.Name).HasMaxLength(200);
ins.HasIndex(x => x.Name).IsUnique();

// ---------- UserProjects (User <-> Project many-to-many) ----------
var up = b.Entity<UserProject>();
up.ToTable("UserProjects");
up.HasKey(x => new { x.UserId, x.ProjectId });
up.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");

up.HasOne(x => x.User)
  .WithMany(u2 => u2.UserProjects)
  .HasForeignKey(x => x.UserId)
  .OnDelete(DeleteBehavior.Cascade);

up.HasOne(x => x.Project)
  .WithMany(p2 => p2.UserProjects)
  .HasForeignKey(x => x.ProjectId)
  .OnDelete(DeleteBehavior.Cascade);

up.HasIndex(x => x.ProjectId);


            // ---------- SupportThread / SupportMessage ----------
            b.Entity<SupportThread>(st =>
            {
                st.ToTable("SupportThreads");

                st.HasOne(x => x.User)
                  .WithMany()
                  .HasForeignKey(x => x.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

                st.HasOne(x => x.Project)
                  .WithMany()
                  .HasForeignKey(x => x.ProjectId)
                  .OnDelete(DeleteBehavior.SetNull);

                // ✅ ExamAttempt ilişkisi (nullable)
                st.HasOne(x => x.ExamAttempt)
                  .WithMany()
                  .HasForeignKey(x => x.ExamAttemptId)
                  .OnDelete(DeleteBehavior.SetNull);

                st.Property(x => x.Subject).HasMaxLength(200);
                st.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
                st.Property(x => x.UpdatedAt).HasColumnType("timestamp with time zone");
                st.Property(x => x.LastMessageAt).HasColumnType("timestamp with time zone");

                // ✅ Bir attempt için tek thread (idempotent)
                st.HasIndex(x => x.ExamAttemptId)
                  .IsUnique()
                  .HasFilter("\"ExamAttemptId\" IS NOT NULL");
            });

            b.Entity<SupportMessage>(sm =>
            {
                sm.ToTable("SupportMessages");
                sm.Property(x => x.Body).HasMaxLength(4000);
                sm.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
                sm.Property(x => x.ReadAtAdmin).HasColumnType("timestamp with time zone");
                sm.Property(x => x.ReadAtUser).HasColumnType("timestamp with time zone");

                sm.HasOne(x => x.Thread)
                  .WithMany(t => t.Messages)
                  .HasForeignKey(x => x.ThreadId)
                  .OnDelete(DeleteBehavior.Cascade);

                sm.HasIndex(x => new { x.ThreadId, x.CreatedAt });
                sm.HasIndex(x => x.IsFromAdmin);
            });

            base.OnModelCreating(b);
        }
    }
}
