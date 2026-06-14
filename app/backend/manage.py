#!/usr/bin/env python
"""Django CLI for occasional admin (migrate, shell, createsuperuser). Not needed to run the app."""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
