from ebook_pipeline.utils.generate_context import ContextGenerator

def test_active_plots(tmp_path):
    """Test that get_active_plots correctly identifies unresolved plot threads."""
    cg = ContextGenerator()
    cg.story_bible = {"plot_threads": [{"id": "p1", "resolved": False}]}
    assert cg.get_active_plots() == ["p1"]

def test_active_plots_with_resolved(tmp_path):
    """Test that resolved plots are not included in active plots."""
    cg = ContextGenerator()
    cg.story_bible = {
        "plot_threads": [
            {"id": "p1", "resolved": False},
            {"id": "p2", "resolved": True},
            {"id": "p3", "resolved": False}
        ]
    }
    assert cg.get_active_plots() == ["p1", "p3"]

def test_active_plots_empty(tmp_path):
    """Test that empty plot threads returns empty list."""
    cg = ContextGenerator()
    cg.story_bible = {"plot_threads": []}
    assert cg.get_active_plots() == []

def test_active_plots_no_threads(tmp_path):
    """Test that missing plot_threads key returns empty list."""
    cg = ContextGenerator()
    cg.story_bible = {}
    assert cg.get_active_plots() == []