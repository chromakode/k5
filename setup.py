#!/usr/bin/env python
from setuptools import setup, find_packages

setup(
    name="k5",
    description="Serves chromakode.com.",
    version="0.1",
    author="Max Goodman",
    author_email="c@chromakode.com",
    keywords="chromakode feed lifestream",
    license="BSD",
    classifiers=[
        "Programming Language :: Python",
        "Topic :: Internet :: WWW/HTTP",
    ],
    packages=find_packages(),
    install_requires=[
        "been",
        "wake",
    ],
    include_package_data=True,
    zip_safe=False,
)
