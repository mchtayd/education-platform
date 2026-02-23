using API.Options;
using Microsoft.Extensions.Options;

namespace API.Services;

public class AiProviderFactory : IAiProviderFactory
{
    private readonly IServiceProvider _sp;
    private readonly AiProviderOptions _opt;

    public AiProviderFactory(IServiceProvider sp, IOptions<AiProviderOptions> opt)
    {
        _sp = sp;
        _opt = opt.Value;
    }

    public IReadOnlyList<string> AvailableProviders => new[] { "ollama", "gemini" };

    public IAiProvider Get(string? providerName)
    {
        var name = (providerName ?? _opt.DefaultProvider ?? "ollama")
            .Trim()
            .ToLowerInvariant();

        return name switch
        {
            "ollama" => _sp.GetRequiredService<OllamaAiProvider>(),
            "gemini" => _sp.GetRequiredService<GeminiAiProvider>(),
            _ => throw new InvalidOperationException($"Desteklenmeyen AI provider: {providerName}")
        };
    }
}