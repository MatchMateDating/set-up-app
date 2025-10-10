import click
from .ai_embeddings import get_conversation_similarity, explain_conversation_similarity

def register_commands(app):
    @app.cli.command("analyze-conversation")
    @click.argument("user_a_id", type=int)
    @click.argument("user_b_id", type=int)
    def analyze_conversation(user_a_id, user_b_id):
        """Analyze conversation similarity between two users."""
        # Flask app context is automatically available
        similarity = get_conversation_similarity(user_a_id, user_b_id)
        explanation = explain_conversation_similarity(user_a_id, user_b_id)

        click.echo(f"Similarity score: {similarity:.2f}")
        click.echo(f"Explanation:\n{explanation}")
