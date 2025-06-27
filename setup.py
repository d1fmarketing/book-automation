#!/usr/bin/env python3
"""Setup configuration for ebook_pipeline package"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="book-automation",
    version="0.10.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="Professional eBook automation pipeline",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/d1fmarketing/book-automation",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Text Processing :: Markup",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "ebook-pipeline=ebook_pipeline.cli:main",
        ],
    },
)
