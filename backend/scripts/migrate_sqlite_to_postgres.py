#!/usr/bin/env python3
"""
Script to migrate data from SQLite to PostgreSQL database.
Run this script after setting up your PostgreSQL database.

Usage:
    python scripts/migrate_sqlite_to_postgres.py
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import User, Image, Match, Conversation, Message, QuizResult, UserSkip, UserBlock, ReferredUsers, PushToken

def migrate_data():
    """Migrate data from SQLite to PostgreSQL."""
    app = create_app()
    
    with app.app_context():
        # Check if PostgreSQL is configured
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        
        if 'sqlite' in db_uri:
            print("Error: SQLite is still configured. Please set PostgreSQL environment variables.")
            print("Required: DB_USERNAME, DB_PASSWORD, DB_HOST, DB_NAME")
            return False
        
        if 'postgresql' not in db_uri:
            print(f"Error: Unexpected database URI: {db_uri}")
            return False
        
        print(f"Connecting to PostgreSQL: {db_uri.split('@')[1] if '@' in db_uri else 'hidden'}")
        
        # Check if tables exist in PostgreSQL
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        if existing_tables:
            response = input(f"Warning: PostgreSQL database already has {len(existing_tables)} tables. Continue? (y/n): ")
            if response.lower() != 'y':
                print("Migration cancelled.")
                return False
        
        # Run migrations to create schema
        print("Running database migrations...")
        try:
            from flask_migrate import upgrade
            upgrade()
            print("✓ Migrations completed")
        except Exception as e:
            print(f"Error running migrations: {e}")
            return False
        
        # Check if SQLite database exists
        sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'users.db')
        
        if not os.path.exists(sqlite_path):
            print(f"SQLite database not found at {sqlite_path}")
            print("No data to migrate. PostgreSQL is ready to use.")
            return True
        
        print(f"\nFound SQLite database at {sqlite_path}")
        print("Starting data migration...")
        
        # Create SQLite connection
        sqlite_uri = f'sqlite:///{sqlite_path}'
        sqlite_engine = create_engine(sqlite_uri)
        SqliteSession = sessionmaker(bind=sqlite_engine)
        sqlite_session = SqliteSession()
        
        try:
            # Migrate Users
            print("Migrating users...")
            sqlite_users = sqlite_session.query(User).all()
            for user in sqlite_users:
                # Check if user already exists
                existing = db.session.query(User).filter_by(id=user.id).first()
                if not existing:
                    db.session.add(user)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_users)} users")
            
            # Migrate Images
            print("Migrating images...")
            sqlite_images = sqlite_session.query(Image).all()
            for image in sqlite_images:
                existing = db.session.query(Image).filter_by(id=image.id).first()
                if not existing:
                    db.session.add(image)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_images)} images")
            
            # Migrate Matches
            print("Migrating matches...")
            sqlite_matches = sqlite_session.query(Match).all()
            for match in sqlite_matches:
                existing = db.session.query(Match).filter_by(id=match.id).first()
                if not existing:
                    db.session.add(match)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_matches)} matches")
            
            # Migrate Conversations
            print("Migrating conversations...")
            sqlite_conversations = sqlite_session.query(Conversation).all()
            for conv in sqlite_conversations:
                existing = db.session.query(Conversation).filter_by(id=conv.id).first()
                if not existing:
                    db.session.add(conv)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_conversations)} conversations")
            
            # Migrate Messages
            print("Migrating messages...")
            sqlite_messages = sqlite_session.query(Message).all()
            for msg in sqlite_messages:
                existing = db.session.query(Message).filter_by(id=msg.id).first()
                if not existing:
                    db.session.add(msg)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_messages)} messages")
            
            # Migrate Quiz Results
            print("Migrating quiz results...")
            sqlite_quizzes = sqlite_session.query(QuizResult).all()
            for quiz in sqlite_quizzes:
                existing = db.session.query(QuizResult).filter_by(id=quiz.id).first()
                if not existing:
                    db.session.add(quiz)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_quizzes)} quiz results")
            
            # Migrate Skips
            print("Migrating skips...")
            sqlite_skips = sqlite_session.query(UserSkip).all()
            for skip in sqlite_skips:
                existing = db.session.query(UserSkip).filter_by(id=skip.id).first()
                if not existing:
                    db.session.add(skip)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_skips)} skips")
            
            # Migrate Blocks
            print("Migrating blocks...")
            sqlite_blocks = sqlite_session.query(UserBlock).all()
            for block in sqlite_blocks:
                existing = db.session.query(UserBlock).filter_by(id=block.id).first()
                if not existing:
                    db.session.add(block)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_blocks)} blocks")
            
            # Migrate ReferredUsers
            print("Migrating referred users...")
            sqlite_referred = sqlite_session.query(ReferredUsers).all()
            for ref in sqlite_referred:
                existing = db.session.query(ReferredUsers).filter_by(id=ref.id).first()
                if not existing:
                    db.session.add(ref)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_referred)} referred user records")
            
            # Migrate Push Tokens
            print("Migrating push tokens...")
            sqlite_tokens = sqlite_session.query(PushToken).all()
            for token in sqlite_tokens:
                existing = db.session.query(PushToken).filter_by(id=token.id).first()
                if not existing:
                    db.session.add(token)
            db.session.commit()
            print(f"✓ Migrated {len(sqlite_tokens)} push tokens")
            
            print("\n✓ Migration completed successfully!")
            print("\nNext steps:")
            print("1. Verify data in PostgreSQL database")
            print("2. Test application with PostgreSQL")
            print("3. Backup SQLite database before removing")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Error during migration: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            sqlite_session.close()

if __name__ == '__main__':
    success = migrate_data()
    sys.exit(0 if success else 1)
