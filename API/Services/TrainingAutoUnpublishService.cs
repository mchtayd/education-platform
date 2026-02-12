// API/Services/TrainingAutoUnpublishService.cs
using API.Data;
using API.Realtime;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace API.Services
{
    public class TrainingAutoUnpublishService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<TrainingAutoUnpublishService> _logger;
        private readonly IHubContext<AnalysisHub> _hub;

        public TrainingAutoUnpublishService(
            IServiceScopeFactory scopeFactory,
            ILogger<TrainingAutoUnpublishService> logger,
            IHubContext<AnalysisHub> hub)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _hub = hub;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // 1 dakikada bir kontrol (istersen 5 dk yapabilirsin)
            var delay = TimeSpan.FromMinutes(1);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    var now = DateTimeOffset.UtcNow;

                    var expired = await db.TrainingAssignments
                        .Where(x => x.UnpublishAt != null && x.UnpublishAt <= now)
                        .ToListAsync(stoppingToken);

                    if (expired.Count > 0)
                    {
                        db.TrainingAssignments.RemoveRange(expired);
                        await db.SaveChangesAsync(stoppingToken);

                        await _hub.Clients.All.SendAsync("analysisChanged", cancellationToken: stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "TrainingAutoUnpublishService error");
                }

                await Task.Delay(delay, stoppingToken);
            }
        }
    }
}
