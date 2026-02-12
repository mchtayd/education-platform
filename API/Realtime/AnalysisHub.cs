//API/Realtime/AnalysisHub.cs
using Microsoft.AspNetCore.SignalR;

namespace API.Realtime
{
    // Basit bir hub; sadece "analysisChanged" eventi yayınlayacağız.
    public class AnalysisHub : Hub { }
}
