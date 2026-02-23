namespace API.Options;

public class AiProviderOptions
{
    // Varsayılan provider (frontend göndermese bile)
    public string DefaultProvider { get; set; } = "gemini";

    // RAG skor eşiği (0.0 - 1.0)
    public float ScoreThreshold { get; set; } = 0.20f;
}