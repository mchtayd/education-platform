namespace API.Models;

public class AIDocumentChunk
{
    public int Id { get; set; }

    public int DocumentId { get; set; }
    public AIDocument Document { get; set; } = null!;

    public int ChunkIndex { get; set; }
    public string Text { get; set; } = "";

    // PostgreSQL real[] olarak saklanacak
    public float[] Embedding { get; set; } = Array.Empty<float>();
}